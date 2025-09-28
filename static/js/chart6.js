
const csvUrl = "/static/data/data_ggsheet.csv";
const svgEl = d3.select("#chart6");
const svgWidth = +svgEl.attr("width") || 1400;
const svgHeight = +svgEl.attr("height") || 700;
svgEl.style("overflow", "visible");

const margin = { top: 60, right: 80, bottom: 30, left: 120 };
const width = svgWidth - margin.left - margin.right;
const height = svgHeight - margin.top - margin.bottom;

const g = svgEl.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const chartColors = [
  "#1ABC9C", "#34495E", "#E74C3C", "#F1C40F",
  "#7F8C8D", "#5DADE2", "#E67E22", "#9B59B6"
];

function formatHourRange(hh) {
  return `${hh}:00-${hh}:59`;
}

// parse number an toàn
function parseNumberSafe(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (s === "") return 0;
  const digits = s.replace(/[^\d\-]/g, "");
  return digits === "" ? 0 : +digits;
}

// parse ngày giờ linh hoạt
function parseDateFlexible(raw) {
  if (!raw && raw !== 0) return null;
  raw = String(raw).trim();
  if (raw === "") return null;

  // thử native
  const d0 = new Date(raw);
  if (!isNaN(d0)) return d0;

  // dd/mm/yyyy [time] [AM/PM]
  let m = raw.match(/^\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if (m) {
    const day = +m[1], month = +m[2], year = +m[3];
    let hh = m[4] ? +m[4] : 0;
    const mm = m[5] ? +m[5] : 0;
    const ss = m[6] ? +m[6] : 0;
    const ampm = m[7];
    if (ampm) {
      const A = ampm.toUpperCase();
      if (A === "PM" && hh < 12) hh += 12;
      if (A === "AM" && hh === 12) hh = 0;
    }
    return new Date(year, month - 1, day, hh, mm, ss);
  }

  // ISO-like yyyy-mm-dd
  m = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

  // fallback: token dd/mm/yyyy
  const token = raw.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  if (token) return parseDateFlexible(token[1]);

  return null;
}

// tìm cột ngày trong row
function findDateValue(row) {
  const keys = Object.keys(row);
  const prefer = keys.find(k => /thời|thoigian|thoi|ngày|ngay|date|bill|order|time/i.test(k));
  if (prefer) return row[prefer];
  for (const k of keys) {
    const v = String(row[k] ?? "");
    if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(v) || /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(v)) return v;
  }
  return "";
}

d3.csv(csvUrl)
.then(rawData => {
  // 1) Build totals per date-hour
  const dateSet = new Set(); // tập các ngày (YYYY-MM-DD)
  const dateHourMap = new Map(); // key = 'YYYY-MM-DD|HH' -> { totalSales, totalQty }

  rawData.forEach(r => {
    const rawDateVal = findDateValue(r);
    const dateObj = parseDateFlexible(rawDateVal);
    if (!dateObj) return; // bỏ dòng không có ngày

    const sale = parseNumberSafe(r["Thành tiền"] ?? r["ThànhTien"] ?? r["Amount"] ?? 0);
    const qty  = parseNumberSafe(r["SL"] ?? r["Số lượng"] ?? r["SoLuong"] ?? r["Qty"] ?? 0);

    const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,"0")}-${String(dateObj.getDate()).padStart(2,"0")}`;
    const hourKey = String(dateObj.getHours()).padStart(2, "0");

    dateSet.add(dateKey);
    const dhKey = `${dateKey}|${hourKey}`;
    if (!dateHourMap.has(dhKey)) dateHourMap.set(dhKey, { totalSales: 0, totalQty: 0 });
    const rec = dateHourMap.get(dhKey);
    rec.totalSales += sale;
    rec.totalQty += qty;
  });

  const totalDays = dateSet.size || 0;
  if (totalDays === 0) {
    g.append("text")
      .attr("x", width/2).attr("y", height/2)
      .attr("text-anchor", "middle")
      .style("fill", "#999")
      .text("Không có dữ liệu ngày hợp lệ (kiểm tra cột ngày trong CSV).");
    console.warn("Cau6: totalDays = 0");
    return;
  }

  // 2) Build dataset cho giờ 08..23: tính sumSales,sumQty,daysWithData -> avg = sum/ daysWithData
  const dataset = [];
  for (let h = 8; h <= 23; h++) {
    const hh = String(h).padStart(2, "0");
    const perDateEntries = [];
    for (const dateKey of Array.from(dateSet).sort()) {
      const dhKey = `${dateKey}|${hh}`;
      const entry = dateHourMap.get(dhKey);
      perDateEntries.push({
        dateKey,
        totalSales: entry ? entry.totalSales : 0,
        totalQty: entry ? entry.totalQty : 0
      });
    }

    const nonZeroDays = perDateEntries.filter(e => (e.totalSales !== 0 || e.totalQty !== 0));
    const daysWithData = nonZeroDays.length;
    const sumSales = perDateEntries.reduce((s, e) => s + e.totalSales, 0);
    const sumQty = perDateEntries.reduce((s, e) => s + e.totalQty, 0);

    const avgSales_nonZero = daysWithData > 0 ? (sumSales / daysWithData) : 0;
    const avgQty_nonZero = daysWithData > 0 ? (sumQty / daysWithData) : 0;

    dataset.push({
      hour: hh,
      hourLabel: formatHourRange(hh),
      avgSales: avgSales_nonZero,   // **dùng avg trên ngày có bán**
      avgQty: avgQty_nonZero,       // **dùng avg trên ngày có bán**
      daysWithData,
      sumSales,
      sumQty,
      perDateEntries
    });
  }

  // debug: show details cho 08
  const debug08 = dataset.find(d => d.hour === "08");
  console.log("Cau6 debug - hour 08 summary:", {
    avgSales: Math.round(debug08.avgSales),
    avgQty: Math.round(debug08.avgQty),
    daysWithData: debug08.daysWithData,
    sumSales: debug08.sumSales,
    sumQty: debug08.sumQty,
    totalDays
  });
  console.table(debug08.perDateEntries || debug08.perDateEntries, ["dateKey", "totalSales", "totalQty"]);

  // 3) scales - dùng max của avgSales (đã là avg trên ngày có bán)
  const x = d3.scaleBand().domain(dataset.map(d => d.hourLabel)).range([0, width]).padding(0.14);
  const yMax = d3.max(dataset, d => d.avgSales) || 1;
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([height, 0]);

  const color = d3.scaleOrdinal().domain(dataset.map(d => d.hourLabel)).range(dataset.map((_, i) => chartColors[i % chartColors.length]));

  // X axis: hiển thị "08:00-08:59", xoay dọc
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -10).attr("y", -5)
    .style("text-anchor", "end")
    .style("font-size", "11px");

  // Y axis: rút gọn (900k, 1.2M)
  g.append("g")
    .call(d3.axisLeft(y).ticks(8).tickFormat(d3.format(".2s")))
    .selectAll("text").style("font-size", "12px");

  // Tooltip (tạo 1 lần)
  let tooltip = d3.select(".tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("background", "white")
      .style("border", "1px solid #999")
      .style("border-radius", "4px")
      .style("padding", "8px 10px")
      .style("font-size", "13px")
      .style("color", "black")
      .style("box-shadow", "0 2px 6px rgba(0,0,0,0.15)");
  }

  // 4) Vẽ cột
  g.selectAll(".bar")
    .data(dataset)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.hourLabel))
    .attr("y", d => y(d.avgSales))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d.avgSales))
    .attr("fill", d => color(d.hourLabel))
    .attr("rx", 4)
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(150).style("opacity", 0.96);
      tooltip.html(`
        <b>Khung giờ:</b> ${d.hourLabel}<br/>
        <b>Doanh số bán TB:</b> ${Math.round(d.avgSales).toLocaleString('vi-VN').replace(/\./g, ",")} VND<br/>
        <b>Số lượng bán TB:</b> ${Math.round(d.avgQty).toLocaleString('vi-VN')} SKUs<br/>
    
      `);
    })
    .on("mousemove", (event) => {
      const rect = tooltip.node().getBoundingClientRect ? tooltip.node().getBoundingClientRect() : { width: 220 };
      let left = event.pageX + 12;
      if (left + rect.width > window.innerWidth - 10) left = event.pageX - rect.width - 20;
      tooltip.style("left", left + "px").style("top", (event.pageY - 40) + "px");
    })
    .on("mouseout", () => tooltip.transition().duration(200).style("opacity", 0));

  // Labels trên cột: hiện doanh số trung bình 
  g.selectAll(".label")
    .data(dataset)
    .enter().append("text")
    .attr("x", d => x(d.hourLabel) + x.bandwidth()/2)
    .attr("y", d => y(d.avgSales) - 6)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("font-weight", "700")
    .text(d => d.avgSales > 0 ? Math.round(d.avgSales).toLocaleString('vi-VN').replace(/\./g, ",") + " VND" : "");
});
