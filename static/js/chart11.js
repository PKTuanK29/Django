
const csvUrl = "/static/data/data_ggsheet.csv";
// Chọn svg và setup kích thước
const svgEl = d3.select("#chart11");
const svgWidth = +svgEl.attr("width") || 1400;
const svgHeight = +svgEl.attr("height") || 700;
svgEl.style("overflow", "visible");

const margin = { top: 60, right: 80, bottom: 30, left: 100 };
const width = svgWidth - margin.left - margin.right;
const height = svgHeight - margin.top - margin.bottom;

const g = svgEl.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

// Đọc file
d3.csv(csvUrl)
.then(data => {
  // Đếm số lượt mua / khách hàng
  const ordersByCustomer = d3.rollup(
    data,
    v => new Set(v.map(d => d["Mã đơn hàng"])).size,
    d => d["Mã khách hàng"]
  );

  // Phân phối số lượt mua
  const distribution = Array.from(
    d3.rollup(
      Array.from(ordersByCustomer.values()),
      v => v.length,
      d => d
    ),
    ([SoLuotMua, SoLuongKH]) => ({ SoLuotMua, SoLuongKH })
  ).sort((a, b) => d3.ascending(a.SoLuotMua, b.SoLuotMua));

  // Scales
  const x = d3.scaleBand()
    .domain(distribution.map(d => d.SoLuotMua))
    .range([0, width])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(distribution, d => d.SoLuongKH)]).nice()
    .range([height, 0]);

  // Trục X
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));

  // Trục Y
  g.append("g").call(d3.axisLeft(y));

  // ✅ Tooltip 1 lần
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

  // Vẽ cột (tất cả 1 màu #1ABC9C)
  g.selectAll(".bar")
    .data(distribution)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.SoLuotMua))
    .attr("y", d => y(d.SoLuongKH))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d.SoLuongKH))
    .attr("fill", "#1ABC9C")
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(150).style("opacity", 0.96);
      tooltip.html(`
        <b>Số lượt mua hàng:</b> ${d.SoLuotMua}<br/>
        <b>Số lượng KH:</b> ${d.SoLuongKH.toLocaleString("en-US")}
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

