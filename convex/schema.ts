import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const discountType = v.union(
  v.literal("percent"),
  v.literal("fixed"),
  v.literal("perCase"),
);

// percent: 0–100 (2.5 = 2.5%). fixed and perCase: centavos.
export const discountRule = v.object({
  type: discountType,
  value: v.number(),
});

export const paymentMethod = v.union(
  v.literal("cash"),
  v.literal("gcash"),
  v.literal("maya"),
  v.literal("bank"),
  v.literal("check"),
);

export const productCategory = v.union(
  v.literal("softdrinks"),
  v.literal("beer"),
  v.literal("other"),
);

export const stockMovementType = v.union(
  v.literal("stock_in"),
  v.literal("sale"),
  v.literal("sale_void"),
  v.literal("return"),
  v.literal("damage"),
  v.literal("adjustment"),
);

export const emptiesMovementType = v.union(
  v.literal("issued"), // client took full cases and now owes the empties
  v.literal("client_return"), // client brought empties back to the warehouse
  v.literal("client_adjustment"), // correction to what a client owes (opening balance, deposit paid, write-off)
  v.literal("to_supplier"), // dealer gave empties back to the supplier
  v.literal("warehouse_adjustment"), // correction to warehouse empties (count, breakage)
);

// All money is stored in centavos. All quantities are whole cases.
// Business dates are "YYYY-MM-DD" strings in Asia/Manila time.
export default defineSchema({
  ...authTables,

  settings: defineTable({
    businessName: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    receiptFooter: v.optional(v.string()),
    paperWidth: v.union(v.literal("58mm"), v.literal("80mm")),
    receiptCopies: v.number(),
    language: v.optional(v.union(v.literal("en"), v.literal("fil"))),
  }),

  products: defineTable({
    name: v.string(),
    category: productCategory,
    price: v.number(), // selling price per case
    cost: v.number(), // cost per case
    returnable: v.boolean(), // returnable bottles and cases, so empties are tracked
    lowStockLevel: v.number(), // 0 turns the alert off
    emptiesOnHand: v.number(),
    active: v.boolean(),
  }),

  clients: defineTable({
    name: v.string(),
    storeName: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    termsDays: v.number(), // 0 = pay on delivery / pickup
    creditLimit: v.optional(v.number()),
    discount: v.optional(discountRule),
    notes: v.optional(v.string()),
    active: v.boolean(),
  }),

  inventoryDays: defineTable({
    date: v.string(),
    status: v.union(v.literal("open"), v.literal("closed")),
    counted: v.boolean(), // closed with a physical count (false = closed automatically)
    closedAt: v.optional(v.number()),
  }).index("by_date", ["date"]),

  dailyStock: defineTable({
    date: v.string(),
    productId: v.id("products"),
    starting: v.number(),
    stockIn: v.number(),
    sold: v.number(),
    returned: v.number(),
    damaged: v.number(),
    adjusted: v.number(),
    counted: v.optional(v.number()),
  })
    .index("by_date_product", ["date", "productId"])
    .index("by_product_date", ["productId", "date"]),

  stockMovements: defineTable({
    date: v.string(),
    productId: v.id("products"),
    type: stockMovementType,
    quantity: v.number(), // signed effect on stock
    orderId: v.optional(v.id("orders")),
    stockInId: v.optional(v.id("stockIns")),
    note: v.optional(v.string()),
  }).index("by_date", ["date"]),

  stockIns: defineTable({
    date: v.string(),
    supplier: v.optional(v.string()),
    reference: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.id("products"),
        name: v.string(),
        quantity: v.number(),
        cost: v.number(),
      }),
    ),
    emptiesReturned: v.array(
      v.object({
        productId: v.id("products"),
        name: v.string(),
        quantity: v.number(),
      }),
    ),
    totalCost: v.number(),
    note: v.optional(v.string()),
  }).index("by_date", ["date"]),

  orders: defineTable({
    orderNo: v.number(),
    date: v.string(),
    clientId: v.id("clients"),
    fulfillment: v.union(v.literal("delivery"), v.literal("pickup")),
    fulfillmentStatus: v.union(
      v.literal("pending"),
      v.literal("out_for_delivery"),
      v.literal("completed"),
    ),
    deliveryAddress: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.id("products"),
        name: v.string(),
        price: v.number(),
        cost: v.number(),
        quantity: v.number(),
        returnable: v.boolean(),
        emptiesReturned: v.number(),
      }),
    ),
    subtotal: v.number(),
    discount: v.optional(
      v.object({
        type: discountType,
        value: v.number(),
        amount: v.number(),
        note: v.optional(v.string()),
      }),
    ),
    total: v.number(),
    amountPaid: v.number(),
    paymentStatus: v.union(
      v.literal("unpaid"),
      v.literal("partial"),
      v.literal("paid"),
    ),
    dueDate: v.string(),
    paidDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    voided: v.boolean(),
    voidReason: v.optional(v.string()),
  })
    .index("by_date", ["date"])
    .index("by_orderNo", ["orderNo"])
    .index("by_client_date", ["clientId", "date"])
    .index("by_client_status", ["clientId", "paymentStatus"])
    .index("by_status_due", ["paymentStatus", "dueDate"]),

  payments: defineTable({
    orderId: v.id("orders"),
    clientId: v.id("clients"),
    amount: v.number(),
    method: paymentMethod,
    reference: v.optional(v.string()),
    date: v.string(),
    note: v.optional(v.string()),
    voided: v.boolean(),
    voidReason: v.optional(v.string()),
  })
    .index("by_order", ["orderId"])
    .index("by_client", ["clientId"])
    .index("by_date", ["date"]),

  clientEmpties: defineTable({
    clientId: v.id("clients"),
    productId: v.id("products"),
    owed: v.number(), // empty cases the client still has to return
  })
    .index("by_client_product", ["clientId", "productId"])
    .index("by_owed", ["owed"]),

  emptiesMovements: defineTable({
    date: v.string(),
    productId: v.id("products"),
    clientId: v.optional(v.id("clients")),
    type: emptiesMovementType,
    quantity: v.number(),
    orderId: v.optional(v.id("orders")),
    stockInId: v.optional(v.id("stockIns")),
    note: v.optional(v.string()),
  })
    .index("by_client", ["clientId"])
    .index("by_date", ["date"]),

  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }).index("by_name", ["name"]),

  auditLog: defineTable({
    userId: v.optional(v.id("users")),
    action: v.string(),
    details: v.string(),
  }),
});
