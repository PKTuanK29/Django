
const csvUrl = "/static/data/data_ggsheet.csv";
// Chọn svg và setup kích thước
const svgEl = d3.select("#chart2");
const svgWidth = +svgEl.attr("width") || 1400;
const svgHeight = +svgEl.attr("height") || 700;
svgEl.style("overflow", "visible");

const margin = { top: 60, right: 80, bottom: 30, left: 120 }; 
const width = svgWidth - margin.left - margin.right;
const height = svgHeight - margin.top - margin.bottom;

const g = svgEl.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

// 🎨 Bảng màu cố định Color1 → Color8
const chartColors = [
  "#1ABC9C", // Color 1
  "#34495E", // Color 2
  "#E74C3C", // Color 3
  "#F1C40F", // Color 4
  "#7F8C8D", // Color 5
  "#5DADE2", // Color 6
  "#E67E22", // Color 7
  "#9B59B6"  // Color 8
];

// 🔹 Hàm định dạng số theo yêu cầu
function formatCurrency(value) {
  if (value >= 1e9) {
    return (value / 1e9).toFixed(3).replace(".", ",") + " triệu VND";
  } else {
    return (value / 1e6).toFixed(0).replace(".", ",") + " triệu VND";
  }
}

d3.csv(csvUrl)
.then(data => {
  // Ép kiểu số an toàn
  data.forEach(d => {
    const rawTien = (d["Thành tiền"] ?? "").toString();
    const rawSL = (d["SL"] ?? "").toString();
    d["Thành tiền"] = +rawTien.replace(/[^0-9\-]/g, "") || 0;
    d["SL"] = +rawSL.replace(/[^0-9\-]/g, "") || 0;
  });

  // Nhóm theo nhóm hàng
  const salesByGroup = d3.rollups(
    data,
    v => ({
      Sales: d3.sum(v, d => d["Thành tiền"]),
      Quantity: d3.sum(v, d => d["SL"])
    }),
    d => `[${d["Mã nhóm hàng"]}] ${d["Tên nhóm hàng"] || d["Nhóm hàng"]}`
  );

  const dataset = salesByGroup.map(([GroupLabel, vals]) => ({
    Group: GroupLabel,
    Sales: vals.Sales,
    Quantity: vals.Quantity
  }));

  // Sort theo doanh số giảm dần
  const sortedData = dataset.sort((a, b) => d3.descending(a.Sales, b.Sales));

  // scales
  const x = d3.scaleLinear().domain([0, d3.max(sortedData, d => d.Sales)]).range([0, width]);
  const y = d3.scaleBand().domain(sortedData.map(d => d.Group)).range([0, height]).padding(0.18);

  // Lấy danh sách nhóm để gán màu
  const groups = [...new Set(sortedData.map(d => d.Group))];
  const color = d3.scaleOrdinal().domain(groups).range(chartColors);

  // trục Y
  const yAxis = g.append("g")
                 .call(d3.axisLeft(y).tickSize(0).tickPadding(8));
  yAxis.selectAll("text").style("font-size", "13px");

  // trục X
  g.append("g")
   .attr("transform", `translate(0,${height})`)
   .call(d3.axisBottom(x).ticks(6).tickFormat(d => (d / 1e6).toFixed(0) + "M"));

  // ✅ tooltip
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

  // vẽ thanh
  g.selectAll(".bar")
   .data(sortedData)
   .enter().append("rect")
   .attr("class", "bar")
   .attr("y", d => y(d.Group))
   .attr("height", y.bandwidth())
   .attr("x", 0)
   .attr("width", d => x(d.Sales))
   .attr("fill", d => color(d.Group))
   .attr("rx", 4)
   .on("mouseover", (event, d) => {
      tooltip.transition().duration(150).style("opacity", 0.96);
      tooltip.html(`
        <b>Nhóm hàng:</b> ${d.Group || "—"}<br/>
        <b>Doanh số:</b> ${formatCurrency(d.Sales)}<br/>
        <b>Số lượng:</b> ${d.Quantity.toLocaleString('vi-VN').replace(/\./g, ",")} SKUs
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

  // nhãn giá trị bên phải cột
  g.selectAll(".label")
   .data(sortedData)
   .enter().append("text")
   .attr("class", "label")
   .attr("y", d => y(d.Group) + y.bandwidth() / 2)
   .attr("x", d => x(d.Sales) + 8)
   .attr("dy", ".35em")
   .attr("text-anchor", "start")
   .attr("fill", "black")
   .style("font-size", "13px")
   .style("font-weight", "600")
   .text(d => formatCurrency(d.Sales));
});

