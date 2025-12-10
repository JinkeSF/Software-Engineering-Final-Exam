const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = 3000;

// 連線資料庫
const db = new sqlite3.Database('database.db');

// 設定靜態檔案 (HTML, CSS)
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); // 支援表單 POST

// ==========================================
// API: 取得所有國家 (填入下拉選單)
// ==========================================
app.get('/api/countries', (req, res) => {
    db.all("SELECT name, alpha_3_code FROM Country ORDER BY name", [], (err, rows) => {
        if (err) return res.send(`<option>Error</option>`);
        let options = `<option value="">-- Select a Country --</option>`;
        rows.forEach(row => {
            options += `<option value="${row.alpha_3_code}">${row.name}</option>`;
        });
        res.send(options);
    });
});

// 我們修改一下 index.html 的下拉選單去觸發這個 (透過 HTMX 的 hx-trigger="load")
// 但為了簡化，我們直接在 Feature 1 的 API 裡處理選單渲染，
// 或者更簡單：讓前端一開始就載入。
// 修正策略：讓 index.html 的 select 直接打 /api/countries 來獲取選項。
// 請回到 index.html，在 <select> 加上 hx-get="/api/countries" hx-trigger="load" 
// (上面的 HTML 已經幫你寫好 hx-trigger="load, change"，
// 但邏輯上有點衝突。為了不讓你改兩次，我們用 server.js 處理這個邏輯)

// ==========================================
// 功能 1: Country TFR History
// 邏輯：如果沒有參數，回傳選項；如果有參數，回傳表格
// ==========================================
app.get('/api/tfr-history', (req, res) => {
    const countryCode = req.query.country_code;
    
    // [除錯重點] 印出現在前端傳過來什麼代碼
    console.log("收到查詢請求，國家代碼為:", countryCode); 

    // 情況 A: 頁面剛載入，HTMX 請求下拉選單的選項
    if (!countryCode) {
        // ... (這裡不用改，維持原本產生 option 的程式碼) ...
        db.all("SELECT name, alpha_3_code FROM Country ORDER BY name", [], (err, rows) => {
            // ... (略) ...
            let options = `<option value="">-- Select a Country --</option>`;
            rows.forEach(row => {
                options += `<option value="${row.alpha_3_code}">${row.name}</option>`;
            });
            res.send(options);
        });
        return;
    }

    // 情況 B: 使用者選了國家
    const sql = `SELECT year, tfr FROM FertilityRecord WHERE country_code = ? ORDER BY year ASC`;
    db.all(sql, [countryCode], (err, rows) => {
        if (err) return res.send(`<div>Error: ${err.message}</div>`);
        
        // [除錯重點] 印出資料庫抓到幾筆資料
        console.log(`找到 ${rows.length} 筆資料`); 

        if (rows.length === 0) return res.send(`<div>No data found for ${countryCode}</div>`);

        let html = `<table><thead><tr><th>Year</th><th>TFR</th></tr></thead><tbody>`;
        rows.forEach(row => {
            html += `<tr><td>${row.year}</td><td>${row.tfr}</td></tr>`;
        });
        html += `</tbody></table>`;
        res.send(html);
    });
});

// ==========================================
// API: 取得 SubRegions 列表 (給功能 2 下拉選單用)
// ==========================================
app.get('/api/subregions', (req, res) => {
    db.all("SELECT id, name FROM SubRegion ORDER BY name", [], (err, rows) => {
        if (err) return res.send('<option>Error</option>');
        let options = '<option value="">-- Select Sub-Region --</option>';
        rows.forEach(r => {
            options += `<option value="${r.id}">${r.name}</option>`;
        });
        res.send(options);
    });
});

// ==========================================
// API: 產生年份列表 (1950 - 2024)
// ==========================================
app.get('/api/years', (req, res) => {
    let options = '<option value="">-- Select Year --</option>';
    // 倒序排列，讓最近的年份在上面
    for (let y = 2024; y >= 1950; y--) {
        options += `<option value="${y}">${y}</option>`;
    }
    res.send(options);
});


// ==========================================
// 功能 2: Sub-region Snapshot
// 邏輯：查詢某區域、某年的所有國家 TFR，由大到小排序
// ==========================================
app.get('/api/subregion-snapshot', (req, res) => {
    // 從網址參數抓取 sub_region_id 和 year
    const { sub_region_id, year } = req.query;

    // 如果使用者還沒選完兩個選項，就先不回傳結果
    if (!sub_region_id || !year) return res.send('');

    const sql = `
        SELECT c.name, f.tfr
        FROM FertilityRecord f
        JOIN Country c ON f.country_code = c.alpha_3_code
        WHERE c.sub_region_id = ? AND f.year = ?
        ORDER BY f.tfr DESC
    `;

    db.all(sql, [sub_region_id, year], (err, rows) => {
        if (err) return res.send(`<div>Error: ${err.message}</div>`);
        if (rows.length === 0) return res.send('<div>No data found for this region/year.</div>');

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Country</th>
                        <th>TFR (${year})</th>
                    </tr>
                </thead>
                <tbody>
        `;
        rows.forEach(row => {
            html += `<tr><td>${row.name}</td><td>${row.tfr}</td></tr>`;
        });
        html += `</tbody></table>`;
        res.send(html);
    });
});

// ==========================================
// API: 取得 Regions 列表 (給功能 3 下拉選單用)
// ==========================================
app.get('/api/regions', (req, res) => {
    db.all("SELECT id, name FROM Region ORDER BY name", [], (err, rows) => {
        if (err) return res.send('<option>Error</option>');
        let options = '<option value="">-- Select Region --</option>';
        rows.forEach(r => {
            options += `<option value="${r.id}">${r.name}</option>`;
        });
        res.send(options);
    });
});

// ==========================================
// 功能 3: Region Max TFR
// 邏輯：選定區域與年份，列出該區域下各子區域的最大 TFR
// ==========================================
app.get('/api/region-max-tfr', (req, res) => {
    const { region_id, year } = req.query;

    if (!region_id || !year) return res.send('');

    const sql = `
        SELECT s.name as sub_region_name, MAX(f.tfr) as max_tfr
        FROM FertilityRecord f
        JOIN Country c ON f.country_code = c.alpha_3_code
        JOIN SubRegion s ON c.sub_region_id = s.id
        WHERE s.region_id = ? AND f.year = ?
        GROUP BY s.name
        ORDER BY max_tfr DESC
    `;

    db.all(sql, [region_id, year], (err, rows) => {
        if (err) return res.send(`<div>Error: ${err.message}</div>`);
        if (rows.length === 0) return res.send('<div>No data found.</div>');

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Sub-Region</th>
                        <th>Max TFR in ${year}</th>
                    </tr>
                </thead>
                <tbody>
        `;
        rows.forEach(row => {
            html += `<tr><td>${row.sub_region_name}</td><td>${row.max_tfr}</td></tr>`;
        });
        html += `</tbody></table>`;
        res.send(html);
    });
});

// ==========================================
// 功能 4: Keyword Search (2020)
// 邏輯：搜尋國家名稱 (模糊比對)，只顯示 2020 年的數據
// ==========================================
app.get('/api/search', (req, res) => {
    const keyword = req.query.keyword;

    // 如果使用者刪光文字，就不顯示任何結果
    if (!keyword || keyword.trim() === '') return res.send('');

    const sql = `
        SELECT c.name, f.tfr
        FROM Country c
        JOIN FertilityRecord f ON c.alpha_3_code = f.country_code
        WHERE c.name LIKE ? AND f.year = 2020
        ORDER BY c.name
    `;

    // 使用 %keyword% 來做前後模糊比對
    db.all(sql, [`%${keyword}%`], (err, rows) => {
        if (err) return res.send(`<div>Error: ${err.message}</div>`);
        if (rows.length === 0) return res.send('<div>No matches found.</div>');

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Country</th>
                        <th>TFR (2020)</th>
                    </tr>
                </thead>
                <tbody>
        `;
        rows.forEach(row => {
            html += `<tr><td>${row.name}</td><td>${row.tfr}</td></tr>`;
        });
        html += `</tbody></table>`;
        res.send(html);
    });
});

// ==========================================
// 功能 5: Add Next Year Record
// 邏輯：找出該國最大年份，新增一筆 (最大年份+1) 的資料
// ==========================================
app.post('/api/add-next-year', (req, res) => {
    const { country_code } = req.body; // 注意：POST 的資料通常在 body，但 HTMX 預設有時會用 query，我們需確認

    // 為了相容性，我們先嘗試從 body 抓，沒有的話抓 query
    const code = country_code || req.query.country_code;

    if (!code) return res.send('<div>Please select a country.</div>');

    // 1. 先查出該國目前的最新年份與 TFR
    db.get("SELECT year, tfr FROM FertilityRecord WHERE country_code = ? ORDER BY year DESC LIMIT 1", [code], (err, row) => {
        if (err) return res.send(`<div>Error: ${err.message}</div>`);
        
        // 如果該國完全沒資料，我們從 2000 年開始
        let nextYear = 2000;
        let lastTfr = 2.0; 

        if (row) {
            nextYear = row.year + 1;
            lastTfr = row.tfr; // 暫時複製去年的數值
        }

        // 2. 插入新資料
        const insertSql = "INSERT INTO FertilityRecord (country_code, year, tfr) VALUES (?, ?, ?)";
        db.run(insertSql, [code, nextYear, lastTfr], function(err) {
            if (err) {
                // 如果重複新增(例如已經按過一次)，資料庫會報錯 (UNIQUE constraint)
                if (err.message.includes("UNIQUE")) {
                    return res.send(`<div style="color:red">Error: Record for ${nextYear} already exists!</div>`);
                }
                return res.send(`<div>Error: ${err.message}</div>`);
            }
            res.send(`<div style="color:green">Success! Added record for ${nextYear} (TFR: ${lastTfr}).</div>`);
        });
    });
});

// ==========================================
// 功能 6: Update TFR Record
// 邏輯：更新某國、某年的 TFR 數值
// ==========================================
// 為了讓 HTMX 方便，我們用 PUT 方法 (Express 支援)
app.put('/api/update-record', (req, res) => {
    // 從 query 或 body 抓取參數
    const { country_code, year, new_tfr } = req.query; 
    // 注意：如果是用 form 提交，資料可能在 req.body，這裡我們統一用 hx-include 或 form 
    // 為了保險，我們判斷一下資料來源
    const c_code = req.body.country_code || req.query.country_code;
    const c_year = req.body.year || req.query.year;
    const c_tfr  = req.body.new_tfr || req.query.new_tfr;

    if (!c_code || !c_year || !c_tfr) {
        return res.send('<div style="color:red">Missing parameters.</div>');
    }

    const sql = `UPDATE FertilityRecord SET tfr = ? WHERE country_code = ? AND year = ?`;
    
    db.run(sql, [c_tfr, c_code, c_year], function(err) {
        if (err) return res.send(`<div>Error: ${err.message}</div>`);
        if (this.changes === 0) return res.send('<div style="color:red">No record found to update.</div>');
        
        res.send(`<div style="color:green">Success! Updated ${c_code} in ${c_year} to TFR ${c_tfr}.</div>`);
    });
});

// ==========================================
// 功能 7: Delete TFR Records (Range)
// 邏輯：刪除某國、某段年份範圍內的資料
// ==========================================
app.delete('/api/delete-range', (req, res) => {
    // 這裡我們假設 HTMX 使用 query string 傳遞參數
    const { country_code, start_year, end_year } = req.query;
    // 若使用 hx-include，參數會在 query 中 (因為是 DELETE/GET) 或 body 中
    // 這裡統一檢查
    const c_code = country_code || req.body.country_code;
    const s_year = start_year || req.body.start_year;
    const e_year = end_year || req.body.end_year;

    if (!c_code || !s_year || !e_year) {
        return res.send('<div style="color:red">Missing parameters.</div>');
    }

    const sql = `DELETE FROM FertilityRecord WHERE country_code = ? AND year BETWEEN ? AND ?`;
    
    db.run(sql, [c_code, s_year, e_year], function(err) {
        if (err) return res.send(`<div>Error: ${err.message}</div>`);
        
        res.send(`<div style="color:green">Success! Deleted ${this.changes} records for ${c_code} (${s_year}-${e_year}).</div>`);
    });
});

// 啟動伺服器
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});