
const csvUrl = "/static/data/data_ggsheet.csv";
const svgEl = d3.select("#chart3");
const svgWidth = +svgEl.attr("width") || 1400;
const svgHeight = +svgEl.attr("height") || 700;
svgEl.style("overflow", "visible");

const margin = { top: 60, right: 80, bottom: 30, left: 120 }; 
const width = svgWidth - margin.left - margin.right;
const height = svgHeight - margin.top - margin.bottom;

const g = svgEl.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const chartColors = [
  "#1ABC9C", "#34495E", "#E74C3C", "#F1C40F",
  "#7F8C8D", "#5DADE2", "#E67E22", "#9B59B6"
];

// 🔹 Hàm định dạng Doanh số
function formatCurrency(value) {
  const trieu = value / 1e6;
  if (trieu < 1000) {
    return d3.format(",.0f")(trieu).replace(".", ",") + " triệu VND";
  } else {
    return d3.format(",.3f")(trieu).replace(".", ",") + " triệu VND";
  }
}

// 🔹 Hàm định dạng Số lượng
function formatQuantity(value) {
  return value.toLocaleString("en-US") + " SKUs"; // luôn dùng dấu phẩy
}

d3.csv(csvUrl)
.then(data => {
  // Ép kiểu dữ liệu số
  data.forEach(d => {
    d["Thành tiền"] = +String(d["Thành tiền"] || "0").replace(/[^0-9\-]/g, "");
    d["SL"] = +String(d["SL"] || "0").replace(/[^0-9\-]/g, "");

    // Parse ngày → tháng
    let rawDate = d["Thời gian tạo đơn"] || d["Ngày"] || d["bill_date"] || "";
    let dateObj = new Date(rawDate);
    if (!isNaN(dateObj)) {
      d.Thang = String(dateObj.getMonth() + 1).padStart(2, "0"); // 01 → 12
    } else {
      d.Thang = null;
    }
  });

  // Gom nhóm theo tháng
  const salesByMonth = d3.rollups(
    data.filter(d => d.Thang),
    v => ({
      Sales: d3.sum(v, d => d["Thành tiền"]),
      Quantity: d3.sum(v, d => d["SL"])
    }),
    d => d.Thang
  );

  // Chuyển về dạng array {Month, Sales, Quantity}
  let dataset = salesByMonth.map(([Month, vals]) => ({
    Month,
    Sales: vals.Sales,
    Quantity: vals.Quantity
  }));

  // Bổ sung tháng thiếu
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    if (!dataset.find(d => d.Month === mm)) {
      dataset.push({ Month: mm, Sales: 0, Quantity: 0 });
    }
  }

  dataset.sort((a, b) => +a.Month - +b.Month);

  // Scale X
  const x = d3.scaleBand()
    .domain(dataset.map(d => d.Month))
    .range([0, width])
    .padding(0.25);

  // Scale Y
  const y = d3.scaleLinear()
    .domain([0, d3.max(dataset, d => d.Sales)]).nice()
    .range([height, 0]);

  // Màu
  const color = d3.scaleOrdinal()
    .domain(dataset.map(d => d.Month))
    .range(dataset.map((_, i) => chartColors[i % chartColors.length]));

  // Trục X
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d => "Tháng " + d));

  // Trục Y
  g.append("g")
    .call(d3.axisLeft(y).ticks(8).tickFormat(d => (d / 1e6).toFixed(0) + "M"));

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
    .data(dataset)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.Month))
    .attr("y", d => y(d.Sales))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d.Sales))
    .attr("fill", d => color(d.Month))
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(150).style("opacity", 0.96);
      tooltip.html(`
        <b>Tháng:</b> ${d.Month}<br/>
        <b>Doanh số:</b> ${formatCurrency(d.Sales)}<br/>
        <b>Số lượng:</b> ${formatQuantity(d.Quantity)}
      `);
    })
    .on("mousemove", (event) => {
      tooltip.style("left", (event.pageX + 15) + "px")
             .style("top", (event.pageY - 40) + "px");
    })
    .on("mouseout", () => tooltip.transition().duration(300).style("opacity", 0));

  // Nhãn trên cột
  g.selectAll(".label")
    .data(dataset)
    .enter().append("text")
    .attr("x", d => x(d.Month) + x.bandwidth() / 2)
    .attr("y", d => y(d.Sales) - 5)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("font-weight", "600")
    .text(d => (d.Sales > 0 ? formatCurrency(d.Sales) : ""));
});

