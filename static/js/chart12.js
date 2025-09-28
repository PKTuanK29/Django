
const csvUrl = "/static/data/data_ggsheet.csv";
// Câu 12 - Phân phối mức chi trả của khách hàng
const svgEl = d3.select("#chart12");
const svgWidth = +svgEl.attr("width") || 1400;
const svgHeight = +svgEl.attr("height") || 700;
svgEl.style("overflow", "visible");

const margin = { top: 60, right: 80, bottom: 30, left: 100 };
const width = svgWidth - margin.left - margin.right;
const height = svgHeight - margin.top - margin.bottom;

const g = svgEl.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

d3.csv(csvUrl)
.then(data => {
  // Tính tổng mức chi trả của mỗi khách hàng
  const spendByCustomer = d3.rollup(
    data,
    v => d3.sum(v, d => +d["Thành tiền"]),
    d => d["Mã khách hàng"]
  );

  const maxSpend = d3.max(spendByCustomer.values());
  const binSize = 50000;

  // Phân phối theo bins
  const bins = d3.histogram()
    .value(d => d)
    .domain([0, maxSpend])
    .thresholds(d3.range(0, maxSpend + binSize, binSize))
    (Array.from(spendByCustomer.values()));

  const distribution = bins.map(bin => ({
    range: [bin.x0, bin.x1],
    count: bin.length
  }));

  const x = d3.scaleBand()
    .domain(distribution.map(d => `${d.range[0]}-${d.range[1]}`))
    .range([0, width])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(distribution, d => d.count)]).nice()
    .range([height, 0]);

  // Trục Y
  g.append("g").call(d3.axisLeft(y));

  // Tooltip
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
      .style("padding", "6px 10px")
      .style("font-size", "13px")
      .style("color", "black")
      .style("box-shadow", "0 2px 6px rgba(0,0,0,0.15)");
  }

  // Vẽ cột
  g.selectAll(".bar")
    .data(distribution)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("x", d => x(`${d.range[0]}-${d.range[1]}`))
    .attr("y", d => y(d.count))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d.count))
    .attr("fill", "#1ABC9C")
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(150).style("opacity", 0.96);
      tooltip.html(`
        <b>Mức chi trả:</b> từ ${d.range[0].toLocaleString()} đến ${d.range[1].toLocaleString()}<br/>
        <b>Số lượng KH:</b> ${d.count.toLocaleString("en-US")}
      `);
    })
    .on("mousemove", (event) => {
      const rect = tooltip.node().getBoundingClientRect();
      let left = event.pageX + 15;
      if (left + rect.width > (window.innerWidth - 10)) {
        left = event.pageX - rect.width - 20;
      }
      tooltip.style("left", left + "px")
             .style("top", (event.pageY - 40) + "px");
    })
    .on("mouseout", () => tooltip.transition().duration(300).style("opacity", 0));
});