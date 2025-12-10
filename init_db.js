const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');

const db = new sqlite3.Database('database.db');

// 讀取並執行 SQL 指令的 helper
const runSQL = (sql) => {
    return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

// 匯入 CSV 到暫存表的 helper
const importCSV = (filePath, tableName) => {
    return new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => rows.push(row))
            .on('end', () => {
                if (rows.length === 0) return resolve();
                
                // 動態產生 INSERT 語句
                const columns = Object.keys(rows[0]);
                const placeholders = columns.map(() => '?').join(',');
                const sql = `INSERT INTO ${tableName} VALUES (${placeholders})`;
                
                db.serialize(() => {
                    db.run("BEGIN TRANSACTION");
                    const stmt = db.prepare(sql);
                    rows.forEach(row => {
                        stmt.run(Object.values(row));
                    });
                    stmt.finalize();
                    db.run("COMMIT", (err) => {
                        if(err) reject(err);
                        else {
                            console.log(`Imported ${rows.length} rows into ${tableName}`);
                            resolve();
                        }
                    });
                });
            });
    });
};

async function buildDatabase() {
    try {
        console.log("Starting ETL Process...");
        
        // 1. 讀取 ETL.sql
        const etlScript = fs.readFileSync('ETL.sql', 'utf8');
        
        // 2. 我們將 ETL 分段執行
        // 先執行 Step 1 & 2 (建立表格和暫存表)
        const setupSQL = etlScript.split('-- Step 3: Load Raw Data')[0];
        await runSQL(setupSQL);
        console.log("Schema and Temp Tables created.");

        // 3. 模擬 Step 3: 匯入 CSV 資料 (Raw Data Loading)
        // 請確保 data1.csv 和 data2.csv 已經在資料夾中
        await importCSV('data1.csv', 'temp_tfr');
        await importCSV('data2.csv', 'temp_nations');
        
        // 4. 執行剩餘的 ETL (Step 4 ~ Step 9: 轉換與載入正式表格)
        const transformSQL = etlScript.split('-- Step 4: Create Target Tables')[1];
        // 補回被 split 切掉的註解以便執行
        await runSQL('-- Step 4: Create Target Tables' + transformSQL);
        
        console.log("ETL Process Completed Successfully! 'database.db' is ready.");
        
    } catch (err) {
        console.error("ETL Failed:", err);
    } finally {
        db.close();
    }
}

buildDatabase();