"""
Flask POS backend (SQLite + SQLAlchemy)
Provides:
- /api/products [GET, POST]
- /api/products/<id> [PUT]
- /api/customers [GET, POST]
- /api/orders [POST]  -> creates order, deducts stock, stores receipt HTML
- /api/orders/<id>/receipt [GET] -> returns HTML receipt
- /api/analytics/top-products [GET]
- /api/stock-alerts [GET]

Run:
  pip install flask sqlalchemy flask_sqlalchemy marshmallow
  python server/pos_server.py
"""

from flask import Flask, request, jsonify, make_response
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import func
import uuid, datetime, json, os

BASE_DIR = os.path.dirname(__file__)
DB_PATH = "sqlite:///" + os.path.join(BASE_DIR, "pos_demo.db")

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = DB_PATH
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

def now_iso():
    return datetime.datetime.utcnow().isoformat()

def gen_id(prefix=""):
    return (prefix + uuid.uuid4().hex)[:32]

# ---------------- Models ----------------
class Product(db.Model):
    id = db.Column(db.String, primary_key=True)
    sku = db.Column(db.String, unique=True, nullable=False)
    name = db.Column(db.String, nullable=False)
    description = db.Column(db.String)
    price = db.Column(db.Integer, nullable=False)  # cents
    tax_percent = db.Column(db.Float, default=0.0)
    stock = db.Column(db.Integer, default=0)
    reorder_threshold = db.Column(db.Integer, default=5)
    created_at = db.Column(db.DateTime, server_default=func.now())

class Customer(db.Model):
    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String)
    phone = db.Column(db.String)
    email = db.Column(db.String)
    created_at = db.Column(db.DateTime, server_default=func.now())

class Order(db.Model):
    id = db.Column(db.String, primary_key=True)
    number = db.Column(db.String, unique=True)
    created_at = db.Column(db.DateTime, server_default=func.now())
    subtotal = db.Column(db.Integer)
    tax = db.Column(db.Integer)
    total = db.Column(db.Integer)
    status = db.Column(db.String, default="paid")
    customer_id = db.Column(db.String, db.ForeignKey('customer.id'), nullable=True)
    receipt_html = db.Column(db.Text)

class OrderItem(db.Model):
    id = db.Column(db.String, primary_key=True)
    order_id = db.Column(db.String, db.ForeignKey('order.id'))
    product_id = db.Column(db.String, db.ForeignKey('product.id'))
    name = db.Column(db.String)
    unit_price = db.Column(db.Integer)  # cents
    quantity = db.Column(db.Integer)
    tax = db.Column(db.Integer)

# ---------------- Helpers ----------------
def to_product_dict(p: Product):
    return dict(id=p.id, sku=p.sku, name=p.name, description=p.description,
                price=p.price, taxPercent=p.tax_percent, stock=p.stock,
                reorderThreshold=p.reorder_threshold)

def ensure_db():
    db.create_all()
    # seed minimal data
    if Product.query.count() == 0:
        p1 = Product(id=gen_id("p_"), sku="SKU-001", name="Milk 1L", price=550, tax_percent=7.0, stock=20)
        p2 = Product(id=gen_id("p_"), sku="SKU-002", name="Bread", price=300, tax_percent=7.0, stock=15)
        p3 = Product(id=gen_id("p_"), sku="SKU-003", name="Coffee", price=450, tax_percent=7.0, stock=8, reorder_threshold=5)
        db.session.add_all([p1,p2,p3]); db.session.commit()

def money_fmt(cents):
    return f"{cents/100:.2f}"

# ---------------- API ----------------
@app.route("/api/products", methods=["GET","POST"])
def products():
    if request.method == "GET":
        prods = Product.query.order_by(Product.name).all()
        return jsonify([to_product_dict(p) for p in prods])
    payload = request.get_json()
    p = Product(id=gen_id("p_"), sku=payload.get("sku") or gen_id("sku"),
                name=payload["name"], description=payload.get("description"),
                price=int(payload.get("price",0)), tax_percent=float(payload.get("tax_percent",0.0)),
                stock=int(payload.get("stock",0)), reorder_threshold=int(payload.get("reorder_threshold",5)))
    db.session.add(p); db.session.commit()
    return jsonify(to_product_dict(p)), 201

@app.route("/api/products/<id>", methods=["PUT"])
def update_product(id):
    p = Product.query.get(id)
    if not p: return ("Not found", 404)
    payload = request.get_json()
    for k in ("name","description","price","tax_percent","stock","reorder_threshold","sku"):
        if k in payload:
            setattr(p, k, payload[k])
    db.session.commit()
    return jsonify(to_product_dict(p))

@app.route("/api/customers", methods=["GET","POST"])
def customers():
    if request.method == "GET":
        cs = Customer.query.order_by(Customer.name).all()
        return jsonify([dict(id=c.id,name=c.name,phone=c.phone,email=c.email) for c in cs])
    payload = request.get_json()
    c = Customer(id=gen_id("c_"), name=payload.get("name"), phone=payload.get("phone"), email=payload.get("email"))
    db.session.add(c); db.session.commit()
    return jsonify(dict(id=c.id,name=c.name,phone=c.phone,email=c.email)), 201

@app.route("/api/orders", methods=["POST"])
def create_order():
    """
    Expected payload:
    {
      customer: {name, phone, email} or null,
      items: [{productId, quantity, unitPrice, taxPercent}],
      payments: [{method, amount, reference}]
    }
    """
    payload = request.get_json()
    items = payload.get("items", [])
    if not items: return ("No items", 400)

    # validate & compute
    subtotal = 0
    tax_total = 0
    product_updates = []
    order_items = []
    for it in items:
        pid = it.get("productId")
        qty = int(it.get("quantity", 1))
        product = Product.query.get(pid)
        if not product:
            return (f"Product not found: {pid}", 400)
        if product.stock < qty:
            return (f"Insufficient stock for {product.name}", 400)
        line = product.price * qty
        tax = round(line * (product.tax_percent or 0.0) / 100.0)
        subtotal += line
        tax_total += tax
        product_updates.append((product, qty))
        order_items.append(dict(product=product, qty=qty, unit_price=product.price, tax=tax))

    total = subtotal + tax_total
    # create or find customer
    cust_id = None
    cust = payload.get("customer")
    if cust:
        c = Customer(id=gen_id("c_"), name=cust.get("name"), phone=cust.get("phone"), email=cust.get("email"))
        db.session.add(c); db.session.commit()
        cust_id = c.id

    order = Order(id=gen_id("o_"), number=f"POS-{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}", subtotal=subtotal, tax=tax_total, total=total, status="paid", customer_id=cust_id)
    db.session.add(order)
    db.session.flush()

    # deduct stock and create order items
    for oi in order_items:
        p = oi["product"]
        qty = oi["qty"]
        p.stock -= qty
        db.session.add(p)
        db_item = OrderItem(id=gen_id("oi_"), order_id=order.id, product_id=p.id, name=p.name, unit_price=oi["unit_price"], quantity=qty, tax=oi["tax"])
        db.session.add(db_item)

    # generate simple receipt HTML
    receipt_html = render_receipt(order, order_items, payload.get("payments",[]), customer=cust)
    order.receipt_html = receipt_html
    db.session.commit()

    # return order summary
    return jsonify(dict(id=order.id, number=order.number, total=order.total, subtotal=order.subtotal, tax=order.tax)), 201

@app.route("/api/orders/<order_id>/receipt", methods=["GET"])
def get_receipt(order_id):
    o = Order.query.get(order_id)
    if not o: return ("Not found", 404)
    return make_response(o.receipt_html, 200, {"Content-Type":"text/html"})

@app.route("/api/analytics/top-products", methods=["GET"])
def top_products():
    limit = int(request.args.get("limit", 10))
    # aggregate order items
    rows = db.session.query(OrderItem.product_id, OrderItem.name, func.sum(OrderItem.quantity).label("units")).group_by(OrderItem.product_id).order_by(func.sum(OrderItem.quantity).desc()).limit(limit).all()
    out = [{"productId": r[0], "name": r[1], "units": int(r[2])} for r in rows]
    return jsonify(out)

@app.route("/api/stock-alerts", methods=["GET"])
def stock_alerts():
    threshold = int(request.args.get("threshold", 5))
    prods = Product.query.filter(Product.stock <= threshold).order_by(Product.stock.asc()).all()
    return jsonify([to_product_dict(p) for p in prods])

# ---------------- Receipt renderer ----------------
def render_receipt(order: Order, order_items: list, payments: list, customer: dict = None):
    lines = []
    lines.append("<html><head><meta charset='utf-8'><title>Receipt</title></head><body style='font-family:Arial;padding:18px'>")
    lines.append(f"<h2>Receipt #{order.number}</h2>")
    lines.append(f"<div>Time: {order.created_at or now_iso()}</div>")
    if customer:
        lines.append(f"<div>Customer: {customer.get('name','')} {customer.get('phone','')}</div>")
    lines.append("<hr/>")
    lines.append("<table style='width:100%;border-collapse:collapse'>")
    lines.append("<thead><tr><th align='left'>Item</th><th>Qty</th><th style='text-align:right'>Price</th></tr></thead><tbody>")
    for it in order_items:
        p = it["product"]
        qty = it["qty"]
        price = p.price
        lines.append(f"<tr><td>{p.name}</td><td style='text-align:center'>{qty}</td><td style='text-align:right'>{money_fmt(price*qty)}</td></tr>")
    lines.append("</tbody></table><hr/>")
    lines.append(f"<div>Subtotal: {money_fmt(order.subtotal)}</div>")
    lines.append(f"<div>Tax: {money_fmt(order.tax)}</div>")
    lines.append(f"<div style='font-weight:700'>Total: {money_fmt(order.total)}</div>")
    if payments:
        lines.append("<h4>Payments</h4><ul>")
        for p in payments:
            lines.append(f"<li>{p.get('method')} • {money_fmt(int(p.get('amount',0)))}</li>")
        lines.append("</ul>")
    lines.append("<div style='margin-top:20px;font-size:12px;color:#666'>Thank you for your purchase!</div>")
    lines.append("</body></html>")
    return "\n".join(lines)

# ---------------- Boot ----------------
if __name__ == "__main__":
    ensure_db()
    app.run(host="0.0.0.0", port=8000, debug=True)