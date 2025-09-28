# charts/views.py
from django.shortcuts import render
from django.http import HttpResponse
import json

try:
    from .models import OrderItem
    MODELS_AVAILABLE = True
except Exception:
    MODELS_AVAILABLE = False


def _build_rows_from_db():
    """Lấy dữ liệu từ DB (nếu có), trả về list[dict] để đưa vào JSON."""
    if not MODELS_AVAILABLE:
        return []

    rows = []
    qs = OrderItem.objects.select_related(
        'order', 'product__category', 'order__customer__segment'
    )

    for it in qs:
        o = it.order
        p = it.product
        c = p.category if p else None
        cust = o.customer if o else None
        seg = cust.segment if cust else None

        rows.append({
            "Thời gian tạo đơn": o.created_at.strftime('%d/%m/%Y %H:%M') if o and o.created_at else "",
            "Mã đơn hàng": o.code if o else "",
            "Mã khách hàng": cust.code if cust else "",
            "Tên khách hàng": cust.name if cust else "",
            "Mã PKKH": seg.code if seg else "",
            "Mô tả Phân Khúc Khách hàng": seg.description if seg else "",
            "Mã nhóm hàng": c.code if c else "",
            "Tên nhóm hàng": c.name if c else "",
            "Mã mặt hàng": p.code if p else "",
            "Tên mặt hàng": p.name if p else "",
            "Giá Nhập": getattr(p, "import_price", ""),
            "SL": it.quantity,
            "Đơn giá": it.unit_price,
            "Thành tiền": it.total_price,
        })
    return rows


def index(request):
    return render(request, "index.html")


def chart_page(request, chart_id):
    """Render chart1.html → chart12.html tùy theo ID."""
    rows = _build_rows_from_db()
    data_json = json.dumps(rows, ensure_ascii=False)
    template_name = f"chart{chart_id}.html"
    try:
        return render(request, template_name, {"data": data_json})
    except Exception as e:
        return HttpResponse(f"Không tìm thấy {template_name}: {e}", status=404)


# Tạo chart1..chart12 tự động (dùng closure để giữ giá trị i)
def make_chart_view(i):
    def view(request):
        return chart_page(request, i)
    return view

for i in range(1, 13):
    locals()[f"chart{i}"] = make_chart_view(i)
