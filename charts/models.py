from django.db import models

class CustomerSegment(models.Model):
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.code}"

class Customer(models.Model):
    code = models.CharField(max_length=50, unique=True)   # Mã khách hàng
    name = models.CharField(max_length=200)
    segment = models.ForeignKey(CustomerSegment, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.code} - {self.name}"

class Category(models.Model):
    code = models.CharField(max_length=50, unique=True)   # Mã nhóm hàng
    name = models.CharField(max_length=200)

    def __str__(self):
        return f"{self.code} - {self.name}"

class Product(models.Model):
    code = models.CharField(max_length=50, unique=True)   # Mã mặt hàng
    name = models.CharField(max_length=300)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    import_price = models.BigIntegerField(null=True, blank=True)  # Giá Nhập

    def __str__(self):
        return f"{self.code} - {self.name}"

class Order(models.Model):
    STATUS_PENDING = 'P'
    STATUS_COMPLETED = 'C'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_COMPLETED, 'Completed'),
    ]

    code = models.CharField(max_length=100)   # Mã đơn hàng (không unique vì có thể ghi nhiều dòng; nhưng thường duy nhất)
    created_at = models.DateTimeField(null=True, blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=1, choices=STATUS_CHOICES, default=STATUS_PENDING)

    def __str__(self):
        return f"{self.code}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    quantity = models.IntegerField(default=0)           # SL
    unit_price = models.BigIntegerField(default=0)      # Đơn giá
    total_price = models.BigIntegerField(default=0)     # Thành tiền

    def __str__(self):
        return f"{self.order.code} - {self.product.code if self.product else 'unknown'}"
