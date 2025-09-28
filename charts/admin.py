from django.contrib import admin
from .models import CustomerSegment, Customer, Category, Product, Order, OrderItem

admin.site.register(CustomerSegment)
admin.site.register(Customer)
admin.site.register(Category)
admin.site.register(Product)

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('code', 'created_at', 'customer')
    inlines = [OrderItemInline]
