
const csvUrl = "/static/data/data_ggsheet.csv";
const svgEl = d3.select("#chart8");
const svgWidth = +svgEl.attr("width") || 1400;
const svgHeight = +svgEl.attr("height") || 700;
svgEl.style("overflow", "visible");

const margin = { top: 60, right: 80, bottom: 30, left: 80 };
const width = svgWidth - margin.left - margin.right;
const height = svgHeight - margin.top - margin.bottom;

const g = svgEl.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const chartColors = d3.schemeCategory10;

function parseMonth(dateStr) {
  const d = new Date(dateStr);
  if (!isNaN(d)) return d.getMonth() + 1; // JS month 0–11
  const m = String(dateStr).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) return +m[2];
  return null;
}

d3.csv(csvUrl)
.then(rawData => {
  // 1. Lấy danh sách tháng và nhóm hàng
  const monthGroupMap = new Map();
  const allMonths = new Set();

  rawData.forEach(r => {
    const month = parseMonth(r["Thời gian tạo đơn"] || r["Ngày"] || r["Date"]);
    if (!month) return;
    const orderId = String(r["Mã đơn hàng"]).trim();
    const groupLabel = `[${r["Mã nhóm hàng"]}] ${r["Tên nhóm hàng"]}`;
    allMonths.add(month);

    const key = `${month}|${groupLabel}`;
    if (!monthGroupMap.has(key)) monthGroupMap.set(key, new Set());
    monthGroupMap.get(key).add(orderId);
  });

  const groups = Array.from(new Set([...monthGroupMap.keys()].map(k => k.split("|")[1])));

  // 2. Tính % xác suất cho từng nhóm theo tháng
  const dataset = [];
  for (let m = 1; m <= 12; m++) {
    const monthOrders = new Set();
    for (const [key, setOrders] of monthGroupMap.entries()) {
      if (+key.split("|")[0] === m) {
        for (const o of setOrders) monthOrders.add(o);
      }
    }
    const grandTotalOrders = monthOrders.size;

    groups.forEach(group => {
      const key = `${m}|${group}`;
      const count = monthGroupMap.has(key) ? monthGroupMap.get(key).size : 0;
      const prob = grandTotalOrders > 0 ? +(count / grandTotalOrders * 100).toFixed(1) : 0;
      dataset.push({
        Month: m,
        GroupLabel: group,
        Orders: count,
        Probability: prob
      });
    });
  }

  // 3. Scales
  const x = d3.scaleLinear().domain([1, 12]).range([0, width]);
  const y = d3.scaleLinear().domain([20, d3.max(dataset, d => d.Probability) || 100]).nice().range([height, 0]);
  const color = d3.scaleOrdinal().domain(groups).range(chartColors);

  // 4. Trục
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(12).tickFormat(d => "Tháng " + String(d).padStart(2, "0")));
  g.append("g").call(d3.axisLeft(y).ticks(10).tickFormat(d => d + "%"));

  // Tooltip
  let tooltip = d3.select(".tooltip");
  if (tooltip.empty()) tooltip = d3.select("body").append("div").attr("class", "tooltip");

  // 5. Line cho từng nhóm
  const line = d3.line()
    .x(d => x(d.Month))
    .y(d => y(d.Probability));

  groups.forEach(group => {
    const dataLine = dataset.filter(d => d.GroupLabel === group);

    g.append("path")
      .datum(dataLine)
      .attr("fill", "none")
      .attr("stroke", color(group))
      .attr("stroke-width", 2)
      .attr("d", line);

    // Vẽ điểm
    g.selectAll(`.dot-${group.replace(/\W/g, "")}`)
      .data(dataLine)
      .enter().append("circle")
      .attr("cx", d => x(d.Month))
      .attr("cy", d => y(d.Probability))
      .attr("r", 4)
      .attr("fill", color(group))
      .on("mouseover", (event, d) => {
        tooltip.transition().duration(150).style("opacity", 0.96);
        tooltip.html(`
          <b>Mặt hàng: </b>${d.GroupLabel}</b><br/>
          <b>Tháng:</b> ${String(d.Month).padStart(2,"0")}<br/>
          <b>Xác suất Bán:</b> ${d.Probability.toString().replace(".", ",")}%
        `);
      })
      .on("mousemove", (event) => {
        const rect = tooltip.node().getBoundingClientRect();
        let left = event.pageX + 12;
        if (left + rect.width > window.innerWidth - 10) left = event.pageX - rect.width - 20;
        tooltip.style("left", left + "px").style("top", (event.pageY - 40) + "px");
      })
      .on("mouseout", () => tooltip.transition().duration(200).style("opacity", 0));
  });

  // 6. Legend
  const legend = svgEl.append("g").attr("transform", `translate(${margin.left + width + 20}, ${margin.top})`);
  groups.forEach((grp, i) => {
    const yPos = i * 25;
    legend.append("circle").attr("cx", 0).attr("cy", yPos).attr("r", 6).attr("fill", color(grp));
    legend.append("text")
      .attr("x", 12)
      .attr("y", yPos + 4)
      .text(grp)
      .style("font-size", "13px")
      .style("alignment-baseline", "middle");
  });
});
