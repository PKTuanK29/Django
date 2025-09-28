# charts/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
]

# Chart1 → Chart12
for i in range(1, 13):
    urlpatterns.append(path(f'chart{i}/', getattr(views, f'chart{i}'), name=f'chart{i}'))
