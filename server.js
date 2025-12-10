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
// 頁面路由 (Page Routes)
// ==========================================
// 首頁 (通常 express.static 會自動處理 index.html，但為了保險可以加)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 各功能獨立頁面
app.get('/feature1', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'feature1.html')); });
app.get('/feature2', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'feature2.html')); });
app.get('/feature3', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'feature3.html')); });
app.get('/feature4', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'feature4.html')); });
app.get('/feature5', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'feature5.html')); });
app.get('/feature6', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'feature6.html')); });
app.get('/feature7', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'feature7.html')); });
app.get('/feature8', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'feature8.html')); });

// ==========================================
// API 端點 (API Endpoints)
// ==========================================

// 1. 取得國家列表
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

// 2. 取得年份列表
app.get('/api/years', (req, res) => {
    let options = '<option value="">-- Select Year --</option>';
    for (let y = 2024; y >= 1950; y--) {
        options += `<option value="${y}">${y}</option>`;
    }
    res.send(options);
});

// 3. 取得子區域列表
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

// 4. 取得大區域列表
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
// 功能實作 API
// ==========================================

// Feature 1: Country TFR History
app.get('/api/tfr-history', (req, res) => {
    const countryCode = req.query.country_code;
    
    // 如果沒有參數，回傳空或選項 (視前端需求，這裡簡化處理)
    if (!countryCode) return res.send('');

    const sql = `SELECT year, tfr FROM FertilityRecord WHERE country_code = ? ORDER BY year ASC`;
    db.all(sql, [countryCode], (err, rows) => {
        if (err) return res.send(`<div>Error: ${err.message}</div>`);
        if (rows.length === 0) return res.send(`<div>No data found.</div>`);

        let html = `<table><thead><tr><th>Year</th><th>TFR</th></tr></thead><tbody>`;
        rows.forEach(row => {
            html += `<tr><td>${row.year}</td><td>${row.tfr}</td></tr>`;
        });
        html += `</tbody></table>`;
        res.send(html);
    });
});

// Feature 2: Sub-region Snapshot
app.get('/api/subregion-snapshot', (req, res) => {
    const { sub_region_id, year } = req.query;
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
        if (rows.length === 0) return res.send('<div>No data found.</div>');

        let html = `
            <table><thead><tr><th>Country</th><th>TFR (${year})</th></tr></thead><tbody>
        `;
        rows.forEach(row => {
            html += `<tr><td>${row.name}</td><td>${row.tfr}</td></tr>`;
        });
        html += `</tbody></table>`;
        res.send(html);
    });
});

// Feature 3: Region Max TFR
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
            <table><thead><tr><th>Sub-Region</th><th>Max TFR in ${year}</th></tr></thead><tbody>
        `;
        rows.forEach(row => {
            html += `<tr><td>${row.sub_region_name}</td><td>${row.max_tfr}</td></tr>`;
        });
        html += `</tbody></table>`;
        res.send(html);
    });
});

// Feature 4: Keyword Search
app.get('/api/search', (req, res) => {
    const keyword = req.query.keyword;
    if (!keyword || keyword.trim() === '') return res.send('');

    const sql = `
        SELECT c.name, f.tfr
        FROM Country c
        JOIN FertilityRecord f ON c.alpha_3_code = f.country_code
        WHERE c.name LIKE ? AND f.year = 2020
        ORDER BY c.name
    `;
    db.all(sql, [`%${keyword}%`], (err, rows) => {
        if (err) return res.send(`<div>Error: ${err.message}</div>`);
        if (rows.length === 0) return res.send('<div>No matches found.</div>');

        let html = `
            <table><thead><tr><th>Country</th><th>TFR (2020)</th></tr></thead><tbody>
        `;
        rows.forEach(row => {
            html += `<tr><td>${row.name}</td><td>${row.tfr}</td></tr>`;
        });
        html += `</tbody></table>`;
        res.send(html);
    });
});

// Feature 5: Add Next Year Record (POST)
app.post('/api/add-next-year', (req, res) => {
    const code = req.body.country_code || req.query.country_code;
    if (!code) return res.send('<div>Please select a country.</div>');

    db.get("SELECT year, tfr FROM FertilityRecord WHERE country_code = ? ORDER BY year DESC LIMIT 1", [code], (err, row) => {
        if (err) return res.send(`<div>Error: ${err.message}</div>`);
        
        let nextYear = 2000;
        let lastTfr = 2.0;
        if (row) {
            nextYear = row.year + 1;
            lastTfr = row.tfr;
        }

        const insertSql = "INSERT INTO FertilityRecord (country_code, year, tfr) VALUES (?, ?, ?)";
        db.run(insertSql, [code, nextYear, lastTfr], function(err) {
            if (err) {
                if (err.message.includes("UNIQUE")) {
                    return res.send(`<div style="color:red">Error: Record for ${nextYear} already exists!</div>`);
                }
                return res.send(`<div>Error: ${err.message}</div>`);
            }
            res.send(`<div style="color:green">Success! Added record for ${nextYear} (TFR: ${lastTfr}).</div>`);
        });
    });
});

// Feature 6: Update Record (PUT)
app.put('/api/update-record', (req, res) => {
    const c_code = req.body.country_code || req.query.country_code;
    const c_year = req.body.year || req.query.year;
    const c_tfr  = req.body.new_tfr || req.query.new_tfr;

    if (!c_code || !c_year || !c_tfr) return res.send('<div style="color:red">Missing parameters.</div>');

    const sql = `UPDATE FertilityRecord SET tfr = ? WHERE country_code = ? AND year = ?`;
    db.run(sql, [c_tfr, c_code, c_year], function(err) {
        if (err) return res.send(`<div>Error: ${err.message}</div>`);
        if (this.changes === 0) return res.send('<div style="color:red">No record found to update.</div>');
        res.send(`<div style="color:green">Success! Updated ${c_code} in ${c_year} to TFR ${c_tfr}.</div>`);
    });
});

// Feature 7: Delete Range (DELETE)
app.delete('/api/delete-range', (req, res) => {
    const c_code = req.body.country_code || req.query.country_code;
    const s_year = req.body.start_year || req.query.start_year;
    const e_year = req.body.end_year || req.query.end_year;

    if (!c_code || !s_year || !e_year) return res.send('<div style="color:red">Missing parameters.</div>');

    const sql = `DELETE FROM FertilityRecord WHERE country_code = ? AND year BETWEEN ? AND ?`;
    db.run(sql, [c_code, s_year, e_year], function(err) {
        if (err) return res.send(`<div>Error: ${err.message}</div>`);
        res.send(`<div style="color:green">Success! Deleted ${this.changes} records.</div>`);
    });
});

// Feature 8: Top 10 Lowest TFR
app.get('/api/top10-lowest', (req, res) => {
    const { year } = req.query;
    if (!year) return res.send('');

    const sql = `
        SELECT c.name, f.tfr
        FROM FertilityRecord f
        JOIN Country c ON f.country_code = c.alpha_3_code
        WHERE f.year = ?
        ORDER BY f.tfr ASC
        LIMIT 10
    `;
    db.all(sql, [year], (err, rows) => {
        if (err) return res.send(`<div>Error: ${err.message}</div>`);
        if (rows.length === 0) return res.send('<div>No data found.</div>');

        let html = `<h4>Top 10 Lowest TFR in ${year}</h4><table><thead><tr><th>Rank</th><th>Country</th><th>TFR</th></tr></thead><tbody>`;
        rows.forEach((row, index) => {
            const style = row.name.includes('Taiwan') ? 'style="background-color: #ffffcc; font-weight:bold;"' : '';
            html += `<tr ${style}><td>${index + 1}</td><td>${row.name}</td><td>${row.tfr}</td></tr>`;
        });
        html += `</tbody></table>`;
        res.send(html);
    });
});

// 啟動伺服器
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});