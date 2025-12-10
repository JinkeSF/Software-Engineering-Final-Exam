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

// 啟動伺服器
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});