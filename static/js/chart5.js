
const csvUrl = "/static/data/data_ggsheet.csv";
const svgEl = d3.select("#chart5");
const svgWidth = +svgEl.attr("width") || 1400;
const svgHeight = +svgEl.attr("height") || 900;
svgEl.style("overflow", "visible");

const margin = { top: 60, right: 80, bottom: 30, left: 120 };
const width = svgWidth - margin.left - margin.right;
const height = svgHeight - margin.top - margin.bottom;

const g = svgEl.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const chartColors = [
  "#1ABC9C", "#34495E", "#E74C3C", "#F1C40F",
  "#7F8C8D", "#5DADE2", "#E67E22", "#9B59B6"
];

function parseDateFlexible(raw) {
  if (!raw && raw !== 0) return null;
  raw = String(raw).trim();
  if (!raw) return null;
  const d0 = new Date(raw);
  if (!isNaN(d0)) return d0;
  let m = raw.match(/^\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if (m) {
    let day = +m[1], month = +m[2], year = +m[3];
    let hh = m[4] ? +m[4] : 0;
    let mmn = m[5] ? +m[5] : 0;
    let ss = m[6] ? +m[6] : 0;
    let ampm = m[7];
    if (ampm) {
      const A = ampm.toUpperCase();
      if (A === "PM" && hh < 12) hh += 12;
      if (A === "AM" && hh === 12) hh = 0;
    }
    return new Date(year, month - 1, day, hh, mmn, ss);
  }
  m = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const token = raw.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  if (token) return parseDateFlexible(token[1]);
  return null;
}

function findDateValue(row) {
  const keys = Object.keys(row);
  const prefer = keys.find(k => /thời|thoigian|ngày|ngay|date|bill|order|time/i.test(k));
  if (prefer) return row[prefer];
  for (const k of keys) {
    const v = String(row[k]);
    if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(v) || /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(v)) return v;
  }
  return "";
}

d3.csv(csvUrl)
.then(rawData => {
  const dailyMap = new Map();
  rawData.forEach(r => {
    const rawDateVal = findDateValue(r);
    const dateObj = parseDateFlexible(rawDateVal);
    if (!dateObj) return;
    const sale = +String(r["Thành tiền"] || r["Amount"] || "0").replace(/[^\d\-]/g, "") || 0;
    const qty  = +String(r["SL"] || r["Số lượng"] || r["Qty"] || "0").replace(/[^\d\-]/g, "") || 0;
    const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,"0")}-${String(dateObj.getDate()).padStart(2,"0")}`;
    if (!dailyMap.has(key)) dailyMap.set(key, { dateObj, totalSales: 0, totalQty: 0 });
    const rec = dailyMap.get(key);
    rec.totalSales += sale;
    rec.totalQty += qty;
  });

  const dayAgg = {};
  for (let i = 1; i <= 31; i++) dayAgg[i] = { sumSales: 0, sumQty: 0, countDays: 0 };

  for (const rec of dailyMap.values()) {
    const dayNum = rec.dateObj.getDate();
    dayAgg[dayNum].sumSales += rec.totalSales;
    dayAgg[dayNum].sumQty += rec.totalQty;
    dayAgg[dayNum].countDays += 1;
  }

  const dataset = [];
  for (let i = 1; i <= 31; i++) {
    if (dayAgg[i].countDays > 0) {
      dataset.push({
        day: String(i).padStart(2,"0"), // luôn hiển thị 01, 02
        avgSales: dayAgg[i].sumSales / dayAgg[i].countDays,
        avgQty: dayAgg[i].sumQty / dayAgg[i].countDays,
        count: dayAgg[i].countDays
      });
    }
  }

  console.log("Dataset Cau5:", dataset);

  if (dataset.length === 0) {
    g.append("text")
      .attr("x", width/2).attr("y", height/2)
      .attr("text-anchor", "middle").style("fill", "#999")
      .text("Không có dữ liệu hợp lệ.");
    return;
  }

  const x = d3.scaleBand()
    .domain(dataset.map(d => d.day))
    .range([0, width]).padding(0.18);

  const maxY = d3.max(dataset, d => d.avgSales) || 1;
  const y = d3.scaleLinear().domain([0, maxY]).nice().range([height, 0]);

  const color = d3.scaleOrdinal()
    .domain(dataset.map(d => d.day))
    .range(dataset.map((_, i) => chartColors[i % chartColors.length]));

g.append("g")
  .attr("transform", `translate(0,${height})`)
  .call(d3.axisBottom(x).tickFormat(d => "Ngày " + d))
  .selectAll("text")
  .attr("transform", "rotate(-90)")   
  .attr("x", -10)                    
  .attr("y", -5)                      
  .style("text-anchor", "end")        
  .style("font-size", "11px");

  g.append("g")
    .call(d3.axisLeft(y).ticks(8).tickFormat(d => (d/1e6).toFixed(0) + "M"))
    .selectAll("text").style("font-size", "12px");

  let tooltip = d3.select(".tooltip");
  if (tooltip.empty()) tooltip = d3.select("body").append("div").attr("class", "tooltip");

  g.selectAll(".bar")
    .data(dataset).enter().append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.day))
    .attr("y", d => y(d.avgSales))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d.avgSales))
    .attr("fill", d => color(d.day))
    .attr("rx", 3)
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(120).style("opacity", 0.95);
      tooltip.html(`
        <b>Ngày: </b> ${d.day}<br/>
        <b>Doanh số bán TB:</b> 
${(d.avgSales/1e6).toFixed(1)} triệu VND<br/>
        <b>Số lượng bán TB:</b> ${Math.round(d.avgQty).toLocaleString('vi-VN')} SKUs<br/>
      
      `);
    })
    .on("mousemove", (event) => {
      const rect = tooltip.node().getBoundingClientRect();
      let left = event.pageX + 12;
      if (left + rect.width > window.innerWidth - 10) left = event.pageX - rect.width - 20;
      tooltip.style("left", left + "px").style("top", (event.pageY - 40) + "px");
    })
    .on("mouseout", () => tooltip.transition().duration(200).style("opacity", 0));

  g.selectAll(".label")
    .data(dataset).enter().append("text")
    .attr("x", d => x(d.day) + x.bandwidth()/2)
    .attr("y", d => y(d.avgSales) - 6)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("font-weight", "700")
    .text(d => d.avgSales > 0 ? (d.avgSales/1e6).toFixed(1) + " tr" : "");
});
