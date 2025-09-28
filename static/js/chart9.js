
const csvUrl = "/static/data/data_ggsheet.csv";
// SVG chính
const svgEl = d3.select("#chart9");
const svgWidth = +svgEl.attr("width") || 1500;

// Kích thước chart con
const topRowCellWidth = 450;   
const bottomRowCellWidth = 500; 
const cellHeight = 300; 
const gapX = 80;   
const gapY = 60;   
const subMargin = { top: 60, right: 80, bottom: 30, left: 100 };
const innerHeight = cellHeight - subMargin.top - subMargin.bottom;
const dashboardOffsetY = 40; 

// 🎨 màu mới
const chartColors = [
  "#1ABC9C", "#34495E", "#E74C3C", "#F1C40F",
  "#7F8C8D", "#5DADE2", "#E67E22", "#9B59B6"
];

// layout order
const layout = [
  { code: "BOT", row: 0, col: 0, type: "top" },
  { code: "SET", row: 0, col: 1, type: "top" },
  { code: "THO", row: 0, col: 2, type: "top" },
  { code: "TMX", row: 1, col: 0, type: "bottom" },
  { code: "TTC", row: 1, col: 1, type: "bottom" }
];

// 👉 Tính chiều cao SVG động dựa trên số hàng
const totalRows = d3.max(layout.map(d => d.row)) + 1; // = 2 hàng
const svgHeight = dashboardOffsetY + totalRows * cellHeight + (totalRows - 1) * gapY + 40;
svgEl.attr("height", svgHeight).style("overflow", "visible");

// tooltip
let tooltip = d3.select(".tooltip");
if (tooltip.empty()) {
  tooltip = d3.select("body").append("div")
    .attr("class","tooltip")
    .style("position","absolute")
    .style("pointer-events","none")
    .style("opacity",0)
    .style("background","white")
    .style("border","1px solid #999")
    .style("border-radius","4px")
    .style("padding","10px")
    .style("font-size","14px")
    .style("line-height","1.5em")
    .style("box-shadow","0 2px 8px rgba(0,0,0,0.2)");
}

d3.csv(csvUrl)
.then(rawData => {
  rawData.forEach(r => {
    for (const k of Object.keys(r)) {
      if (typeof r[k] === "string") r[k] = r[k].trim();
    }
  });

  // nhóm dữ liệu theo nhóm hàng
  const groupsMap = new Map();
  rawData.forEach(r => {
    const groupCode = r["Mã nhóm hàng"] || r["Ma nhom hang"] || "";
    const groupName = r["Tên nhóm hàng"] || r["Ten nhom hang"] || "";
    const itemCode = r["Mã mặt hàng"] || r["MaMatHang"] || "";
    const itemName = r["Tên mặt hàng"] || r["TenMatHang"] || "";
    const orderId = (r["Mã đơn hàng"] || r["MaDonHang"] || "").trim();
    if (!groupCode || !orderId) return;

    if (!groupsMap.has(groupCode)) {
      groupsMap.set(groupCode, { groupCode, groupName, ordersOfGroup: new Set(), items: new Map() });
    }
    const g = groupsMap.get(groupCode);
    g.ordersOfGroup.add(orderId);

    const ic = itemCode || ("ITEM_" + itemName);
    if (!g.items.has(ic)) {
      g.items.set(ic, { itemCode: ic, itemName: itemName || ic, orders: new Set() });
    }
    g.items.get(ic).orders.add(orderId);
  });

  // Vẽ từng chart con
  layout.forEach(({ code, row, col, type }) => {
    const cellWidth = type === "top" ? topRowCellWidth : bottomRowCellWidth;
    const innerWidth = cellWidth - subMargin.left - subMargin.right;

    // căn giữa từng hàng
    let totalRowWidth, offsetX;
    if (type === "top") {
      totalRowWidth = 3 * topRowCellWidth + 2 * gapX;
      offsetX = (svgWidth - totalRowWidth) / 2;
    } else {
      totalRowWidth = 2 * bottomRowCellWidth + gapX;
      offsetX = (svgWidth - totalRowWidth) / 2;
    }

    const gx = svgEl.append("g")
      .attr("transform", 
        `translate(${offsetX + col*(cellWidth+gapX)},${row*(cellHeight+gapY) + dashboardOffsetY})`
      );

    let groupObj = groupsMap.get(code);
    if (!groupObj) {
      for (const [k,v] of groupsMap.entries()) {
        if (k.toUpperCase().includes(code)) { groupObj = v; break; }
      }
    }
    if (!groupObj) return;

    const ordersOfGroupCount = groupObj.ordersOfGroup.size;
    const items = Array.from(groupObj.items.values()).map(it => {
      const prob = ordersOfGroupCount > 0 ? +(it.orders.size / ordersOfGroupCount * 100).toFixed(1) : 0;
      return {
        itemLabel: `[${it.itemCode}] ${it.itemName}`,
        prob
      };
    }).sort((a,b) => d3.descending(a.prob, b.prob));

    const x = d3.scaleLinear()
      .domain([0, d3.max(items, d => d.prob) || 1])
      .range([0, innerWidth]);

    const y = d3.scaleBand()
      .domain(items.map(d => d.itemLabel))
      .range([0, innerHeight])
      .padding(0.25);

    const innerG = gx.append("g")
      .attr("transform", `translate(${subMargin.left},${subMargin.top})`);

    innerG.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .selectAll("text")
      .style("font-size","13px");

    innerG.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => d + "%"))
      .selectAll("text")
      .style("font-size","12px");

    // vẽ bar 
    innerG.selectAll(".bar")
      .data(items).enter().append("rect")
      .attr("class","bar")
      .attr("y", d => y(d.itemLabel))
      .attr("height", y.bandwidth())
      .attr("x", 0) 
      .attr("width", d => x(d.prob))
      .attr("fill", (d,i) => chartColors[i % chartColors.length])
      .on("mouseover", (event, d) => {
        tooltip.transition().duration(120).style("opacity",0.98);
        tooltip.html(`
          <b>Mặt hàng:</b> ${d.itemLabel}<br/>
          <b>Xác suất bán MH/NH:</b> ${d.prob.toString().replace(".", ",")}%
        `);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", (event.pageX + 12) + "px")
               .style("top", (event.pageY - 45) + "px");
      })
      .on("mouseout", () => tooltip.transition().duration(200).style("opacity",0));

    innerG.selectAll(".label")
      .data(items).enter().append("text")
      .attr("x", d => x(d.prob) + 6)
      .attr("y", d => y(d.itemLabel) + y.bandwidth()/2 + 4)
      .style("font-size","13px")
      .style("fill","#333")
      .text(d => d.prob.toString().replace(".", ",") + "%");

    gx.append("text")
      .attr("x", subMargin.left)
      .attr("y", 20)
      .style("font-size","16px")
      .style("font-weight","bold")
      .style("fill","#16A085")
      .text(`[${groupObj.groupCode}] ${groupObj.groupName}`);
  });
});
