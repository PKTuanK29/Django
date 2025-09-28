
const csvUrl = "/static/data/data_ggsheet.csv";
// SVG chính
const svgEl = d3.select("#chart10");
const svgWidth = +svgEl.attr("width") || 1500;

// Layout cho chart con
const topRowCellWidth = 500;     // nhỏ lại để xích gần nhau
const bottomRowCellWidth = 520;  // nhỏ lại để xích gần nhau
const cellHeight = 340;          // cao hơn
const gapX = -20;   // ép gần hơn (âm nếu muốn dí sát)
const gapY = 40;    // khoảng cách dọc
const subMargin = { top: 50, right: 50, bottom: 30, left: 80 }; 
const innerHeight = cellHeight - subMargin.top - subMargin.bottom;
const dashboardOffsetY = 20;

// Màu cố định
const chartColors = [
  "#1ABC9C", "#34495E", "#E74C3C", "#F1C40F",
  "#7F8C8D", "#5DADE2", "#E67E22", "#9B59B6"
];

// Layout order + domain OY cứng
const layout = [
  { code: "BOT", row: 0, col: 0, type: "top", yDomain: [80, 120] },
  { code: "SET", row: 0, col: 1, type: "top", yDomain: [5, 25] },
  { code: "THO", row: 0, col: 2, type: "top", yDomain: [10, 35] },
  { code: "TMX", row: 1, col: 0, type: "bottom", yDomain: [30, 50] },
  { code: "TTC", row: 1, col: 1, type: "bottom", yDomain: [30, 80] }
];

// Chiều cao SVG động
const totalRows = d3.max(layout.map(d => d.row)) + 1;
const svgHeight = dashboardOffsetY + totalRows * cellHeight + (totalRows - 1) * gapY + 40;
svgEl.attr("height", svgHeight).style("overflow", "visible");

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
    .style("padding", "10px")
    .style("font-size", "14px")
    .style("line-height", "1.5em")
    .style("box-shadow", "0 2px 8px rgba(0,0,0,0.2)");
}

// Parse ngày
function parseDateFlexible(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (!isNaN(d)) return d;

  const m = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const day = +m[1], month = +m[2], year = +m[3];
    return new Date(year, month - 1, day);
  }
  return null;
}

// Lấy cột ngày trong row
function findDateValue(row) {
  const keys = Object.keys(row);
  const prefer = keys.find(k => /thời|thoigian|ngày|date|order|time/i.test(k));
  if (prefer) return row[prefer];
  return "";
}

d3.csv(csvUrl)
.then(rawData => {
  rawData.forEach(r => {
    for (const k of Object.keys(r)) {
      if (typeof r[k] === "string") r[k] = r[k].trim();
    }
  });

  // Gom dữ liệu
  const groupsMap = new Map();

  rawData.forEach(r => {
    const groupCode = r["Mã nhóm hàng"] || r["Ma nhom hang"] || "";
    const groupName = r["Tên nhóm hàng"] || r["Ten nhom hang"] || "";
    const itemCode = r["Mã mặt hàng"] || r["MaMatHang"] || "";
    const itemName = r["Tên mặt hàng"] || r["TenMatHang"] || "";
    const orderId = (r["Mã đơn hàng"] || r["MaDonHang"] || "").trim();
    const rawDate = findDateValue(r);
    const dateObj = parseDateFlexible(rawDate);
    if (!groupCode || !orderId || !dateObj) return;

    const month = dateObj.getMonth() + 1;

    if (!groupsMap.has(groupCode)) {
      groupsMap.set(groupCode, { groupCode, groupName, months: new Map() });
    }
    const g = groupsMap.get(groupCode);

    if (!g.months.has(month)) {
      g.months.set(month, { ordersOfGroup: new Set(), items: new Map() });
    }
    const mObj = g.months.get(month);

    mObj.ordersOfGroup.add(orderId);

    const ic = itemCode || ("ITEM_" + itemName);
    if (!mObj.items.has(ic)) {
      mObj.items.set(ic, { itemCode: ic, itemName: itemName || ic, orders: new Set() });
    }
    mObj.items.get(ic).orders.add(orderId);
  });

  // Vẽ từng chart con
  layout.forEach(({ code, row, col, type, yDomain }) => {
    const cellWidth = type === "top" ? topRowCellWidth : bottomRowCellWidth;
    const innerWidth = cellWidth - subMargin.left - subMargin.right;

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
        `translate(${offsetX + col * (cellWidth + gapX)},${row * (cellHeight + gapY) + dashboardOffsetY})`
      );

    let groupObj = groupsMap.get(code);
    if (!groupObj) return;

    // Dataset cho từng mặt hàng qua 12 tháng
    const itemsSet = new Set();
    groupObj.months.forEach(m => {
      m.items.forEach(it => itemsSet.add(it.itemCode));
    });
    const items = Array.from(itemsSet);

    const dataset = items.map(ic => {
      return {
        itemCode: ic,
        itemName: (() => {
          for (const m of groupObj.months.values()) {
            if (m.items.has(ic)) return m.items.get(ic).itemName;
          }
          return ic;
        })(),
        values: d3.range(1, 13).map(month => {
          const mObj = groupObj.months.get(month);
          if (!mObj) return { month, prob: 0 };
          const totalOrders = mObj.ordersOfGroup.size;
          const prob = mObj.items.has(ic) ? +(mObj.items.get(ic).orders.size / totalOrders * 100).toFixed(1) : 0;
          return { month, prob };
        })
      };
    });

    // scale
    const x = d3.scaleLinear().domain([1, 12]).range([0, innerWidth]);
    const y = d3.scaleLinear()
      .domain(yDomain)
      .range([innerHeight, 0]);

    const line = d3.line()
      .x(d => x(d.month))
      .y(d => y(d.prob));

    const innerG = gx.append("g")
      .attr("transform", `translate(${subMargin.left},${subMargin.top})`);

    // trục X
    innerG.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(12).tickFormat(d => "T" + d3.format("02")(d)))
      .selectAll("text").style("font-size", "12px");

    // trục Y
    innerG.append("g")
      .call(d3.axisLeft(y).ticks(6).tickFormat(d => d + "%"))
      .selectAll("text").style("font-size", "12px");

    // vẽ line + dot
    dataset.forEach((item, i) => {
      innerG.append("path")
        .datum(item.values)
        .attr("fill", "none")
        .attr("stroke", chartColors[i % chartColors.length])
        .attr("stroke-width", 2)
        .attr("d", line);

      innerG.selectAll(".dot-" + i)
        .data(item.values)
        .enter().append("circle")
        .attr("class", "dot-" + i)
        .attr("cx", d => x(d.month))
        .attr("cy", d => y(d.prob))
        .attr("r", 3.5)
        .attr("fill", chartColors[i % chartColors.length])
        .on("mouseover", (event, d) => {
          tooltip.transition().duration(120).style("opacity", 0.98);
          tooltip.html(`
            <b>Mặt hàng:</b> [${item.itemCode}] ${item.itemName}<br/>
            <b>Tháng:</b> ${d3.format("02")(d.month)}<br/>
            <b>Xác suất bán MH/NH:</b> ${d.prob.toString().replace(".", ",")}%
          `);
        })
        .on("mousemove", (event) => {
          tooltip.style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY - 45) + "px");
        })
        .on("mouseout", () => tooltip.transition().duration(200).style("opacity", 0));
    });

    // tiêu đề chart con
    gx.append("text")
      .attr("x", subMargin.left)
      .attr("y", 20)
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .style("fill", "#16A085")
      .text(`[${groupObj.groupCode}] ${groupObj.groupName}`);
  });
});
