# charts/management/commands/import_data.py
import csv
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime
from charts.models import Customer, CustomerSegment, Category, Product, Order, OrderItem
import os

def parse_datetime_flex(s):
    if not s:
        return None
    s = s.strip()
    for fmt in ('%d/%m/%Y %H:%M', '%d/%m/%Y %H:%M:%S', '%d/%m/%Y', '%m/%d/%Y %H:%M', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
        try:
            return datetime.strptime(s, fmt)
        except:
            continue
    # last resort: try to parse day/month/year without time
    try:
        parts = s.split(' ')
        d = parts[0]
        dd, mm, yy = d.split('/')
        return datetime(int(yy), int(mm), int(dd))
    except:
        return None

def parse_int_safe(s):
    if s is None:
        return 0
    s = str(s).strip()
    if s == '':
        return 0
    s = ''.join(ch for ch in s if ch.isdigit() or ch == '-')
    try:
        return int(s)
    except:
        return 0

class Command(BaseCommand):
    help = "Import orders from CSV into DB"

    def add_arguments(self, parser):
        parser.add_argument('csv_path', type=str)

    def handle(self, *args, **options):
        path = options['csv_path']
        if not os.path.exists(path):
            self.stderr.write(self.style.ERROR(f"File not found: {path}"))
            return

        with open(path, newline='', encoding='utf-8-sig') as f:
            sample = f.read(4096)
            f.seek(0)
            # try to detect delimiter simply:
            if '\t' in sample and sample.count('\t') > sample.count(','):
                dialect_delim = '\t'
            else:
                dialect_delim = ','
            reader = csv.DictReader(f, delimiter=dialect_delim)
            count = 0
            for row in reader:
                # map headers (hỗ trợ header tiếng việt như bạn cung cấp)
                created_raw = row.get('Thời gian tạo đơn') or row.get('Thoi gian tao don') or row.get('Thời gian') or row.get('time') or ''
                created_at = parse_datetime_flex(created_raw)

                order_code = (row.get('Mã đơn hàng') or row.get('Ma don hang') or row.get('Order') or '').strip()
                cust_code = (row.get('Mã khách hàng') or row.get('Ma khach hang') or '').strip()
                cust_name = (row.get('Tên khách hàng') or row.get('Ten khach hang') or '').strip()

                seg_code = (row.get('Mã PKKH') or row.get('Ma PKKH') or row.get('Mã phân khúc') or '').strip()
                seg_desc = (row.get('Mô tả Phân Khúc Khách hàng') or row.get('Mo ta') or '').strip()

                cat_code = (row.get('Mã nhóm hàng') or row.get('Ma nhom hang') or '').strip()
                cat_name = (row.get('Tên nhóm hàng') or row.get('Ten nhom hang') or '').strip()

                prod_code = (row.get('Mã mặt hàng') or row.get('Ma mat hang') or '').strip()
                prod_name = (row.get('Tên mặt hàng') or row.get('Ten mat hang') or '').strip()

                import_price = parse_int_safe(row.get('Giá Nhập') or row.get('Gia Nhap') or row.get('ImportPrice') or 0)
                qty = parse_int_safe(row.get('SL') or row.get('Số lượng') or row.get('Qty') or 0)
                unit_price = parse_int_safe(row.get('Đơn giá') or row.get('Don gia') or row.get('UnitPrice') or 0)
                total_price = parse_int_safe(row.get('Thành tiền') or row.get('Thanh tien') or row.get('Total') or 0)

                # segment
                segment = None
                if seg_code:
                    segment, _ = CustomerSegment.objects.get_or_create(code=seg_code, defaults={'description': seg_desc})

                # customer
                customer = None
                if cust_code:
                    customer, _ = Customer.objects.get_or_create(code=cust_code, defaults={'name': cust_name, 'segment': segment})

                # category
                category = None
                if cat_code:
                    category, _ = Category.objects.get_or_create(code=cat_code, defaults={'name': cat_name})

                # product
                product = None
                if prod_code:
                    product, _ = Product.objects.get_or_create(code=prod_code, defaults={'name': prod_name, 'category': category, 'import_price': import_price})
                else:
                    # if no product code, try name
                    if prod_name:
                        product, _ = Product.objects.get_or_create(name=prod_name, defaults={'category': category, 'import_price': import_price, 'code': f"GEN_{prod_name[:20]}"})

                # order header (group by order_code)
                order = None
                if order_code:
                    order, created = Order.objects.get_or_create(code=order_code, defaults={'created_at': created_at, 'customer': customer})
                    if not created and order.created_at is None and created_at:
                        order.created_at = created_at
                        order.save()
                else:
                    # create a synthetic order if no code
                    order = Order.objects.create(code=f"GEN-{count}", created_at=created_at, customer=customer)

                # order item
                OrderItem.objects.create(order=order, product=product, quantity=qty, unit_price=unit_price, total_price=total_price)
                count += 1

        self.stdout.write(self.style.SUCCESS(f"Imported {count} rows from {path}"))
