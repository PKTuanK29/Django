
const csvUrl = "/static/data/data_ggsheet.csv";
const svgEl = d3.select("#chart7");
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

d3.csv(csvUrl)
.then(rawData => {
  const allOrders = new Set(rawData.map(r => String(r["Mã đơn hàng"]).trim()).filter(x => x !== ""));
  const grandTotalOrders = allOrders.size;

  const groupMap = new Map();
  rawData.forEach(r => {
    const groupLabel = `[${r["Mã nhóm hàng"]}] ${r["Tên nhóm hàng"]}`;
    const orderId = String(r["Mã đơn hàng"]).trim();
    if (!orderId) return;
    if (!groupMap.has(groupLabel)) groupMap.set(groupLabel, new Set());
    groupMap.get(groupLabel).add(orderId);
  });

  const dataset = [];
  for (const [grp, orderSet] of groupMap.entries()) {
    const count = orderSet.size;
    const prob = grandTotalOrders > 0 ? +(count / grandTotalOrders * 100).toFixed(1) : 0;
    dataset.push({ GroupLabel: grp, Orders: count, Probability: prob });
  }

  dataset.sort((a, b) => d3.descending(a.Probability, b.Probability));

  const y = d3.scaleBand()
    .domain(dataset.map(d => d.GroupLabel))
    .range([0, height])
    .padding(0.2);

  const x = d3.scaleLinear()
    .domain([0, d3.max(dataset, d => d.Probability) || 1])
    .nice()
    .range([0, width]);

  const color = d3.scaleOrdinal()
    .domain(dataset.map(d => d.GroupLabel))
    .range(chartColors);

  g.append("g").call(d3.axisLeft(y).tickSize(0)).selectAll("text").style("font-size", "13px");
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => d + "%"))
    .selectAll("text").style("font-size", "12px");

  let tooltip = d3.select(".tooltip");
  if (tooltip.empty()) tooltip = d3.select("body").append("div").attr("class", "tooltip");

  g.selectAll(".bar")
    .data(dataset)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("y", d => y(d.GroupLabel))
    .attr("height", y.bandwidth())
    .attr("x", 0)
    .attr("width", d => x(d.Probability))
    .attr("fill", d => color(d.GroupLabel))
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(150).style("opacity", 0.96);
      tooltip.html(`
        <b>Nhóm hàng:</b> ${d.GroupLabel}<br/>
        <b>Số Lượng Đơn Bán:</b> ${d.Orders.toLocaleString("vi-VN").replace(".", ",")}<br/>
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

  g.selectAll(".label")
    .data(dataset)
    .enter().append("text")
    .attr("x", d => x(d.Probability) + 6)
    .attr("y", d => y(d.GroupLabel) + y.bandwidth() / 2 + 4)
    .attr("fill", "black")
    .style("font-size", "12px")
    .style("font-weight", "600")
    .text(d => d.Probability.toString().replace(".", ",") + "%");
});
