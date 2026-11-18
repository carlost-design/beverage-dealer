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

// The two suppliers with their own tracking tab. Other products aren't in either.
export const supplierKey = v.union(v.literal("coke"), v.literal("sanMiguel"));
export const productSupplier = v.union(v.literal("coke"), v.literal("sanMiguel"), v.literal("other"));

export const checkStatus = v.union(v.literal("pending"), v.literal("cleared"), v.literal("bounced"));

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

// All money is stored in centavos. Case quantities are whole or half cases (12.5).
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
    depositPerCase: v.optional(v.number()), // deposit for each case a client keeps
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
    // Which tracking tab it belongs to. Missing: from the category (see lib/suppliers).
    supplier: v.optional(productSupplier),
    emptyValue: v.optional(v.number()), // what the supplier takes off for each empty case returned
    // Kasalo, C8, 1.5L…: products in a group are listed together on orders and receipts.
    groupId: v.optional(v.id("productGroups")),
  }),

  // The groups, in the order the owner set (position, lowest first).
  productGroups: defineTable({
    name: v.string(),
    position: v.number(),
  }),

  clients: defineTable({
    name: v.string(),
    storeName: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    termsDays: v.number(), // 0 = pay on delivery / pickup
    creditLimit: v.optional(v.number()),
    // Old whole-order discount. No longer used; kept so older rows still load.
    discount: v.optional(discountRule),
    // Usual discount per case for each product, filled in on new orders.
    productDiscounts: v.optional(v.array(v.object({ productId: v.id("products"), perCase: v.number() }))),
    // This client's own price per case. Products not listed use the price on the Products page.
    productPrices: v.optional(v.array(v.object({ productId: v.id("products"), price: v.number() }))),
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
        discountPerCase: v.optional(v.number()), // centavos off each case
      }),
    ),
    subtotal: v.number(), // after the per-case discounts, before deposits and refunds
    // Whole-order discount on older orders only. New orders use discountPerCase.
    discount: v.optional(
      v.object({
        type: discountType,
        value: v.number(),
        amount: v.number(),
        note: v.optional(v.string()),
      }),
    ),
    // Cases the client paid a deposit on (added to the total) and deposit cases
    // they brought back (subtracted), at depositPerCase each.
    depositCases: v.optional(v.number()),
    refundCases: v.optional(v.number()),
    depositPerCase: v.optional(v.number()),
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

  // A purchase from Coke or San Miguel: full goods − empties = total.
  supplierPurchases: defineTable({
    supplier: supplierKey,
    date: v.string(),
    reference: v.optional(v.string()), // invoice or delivery receipt number
    items: v.array(
      v.object({
        productId: v.id("products"),
        name: v.string(),
        quantity: v.number(), // full cases bought
        cost: v.number(), // full-goods price per case
        emptiesReturned: v.number(),
        emptyValue: v.number(), // taken off for each empty case
      }),
    ),
    cases: v.number(),
    empties: v.number(),
    fullGoods: v.number(), // full cases × cost
    emptiesAmount: v.number(), // empties × empty value
    total: v.number(), // fullGoods − emptiesAmount
    note: v.optional(v.string()),
    stockInId: v.optional(v.id("stockIns")), // set once the cases were added to stock
  })
    .index("by_supplier_date", ["supplier", "date"])
    .index("by_supplier_stock", ["supplier", "stockInId"]),

  // Checks given to a supplier (San Miguel), with the date on the check and
  // the date the payment is due.
  supplierChecks: defineTable({
    supplier: supplierKey,
    checkNo: v.string(),
    bank: v.optional(v.string()),
    amount: v.number(),
    checkDate: v.string(),
    dueDate: v.string(),
    status: checkStatus,
    note: v.optional(v.string()),
  })
    .index("by_supplier_due", ["supplier", "dueDate"])
    .index("by_status", ["status", "supplier"]),

  // Payroll (Sahod tab). Pay is weekly, Monday to Sunday.
  employees: defineTable({
    name: v.string(),
    active: v.boolean(),
  }),

  // A daily rate and the first day it applies. Days before it keep the old rate.
  employeeRates: defineTable({
    employeeId: v.id("employees"),
    dailyRate: v.number(), // centavos per day
    effectiveFrom: v.string(),
  }).index("by_employee_from", ["employeeId", "effectiveFrom"]),

  // Days worked: 1 = whole day, 0.5 = half day. No row = absent.
  attendance: defineTable({
    employeeId: v.id("employees"),
    date: v.string(),
    days: v.number(),
  })
    .index("by_employee_date", ["employeeId", "date"])
    .index("by_date", ["date"]),

  cashAdvances: defineTable({
    employeeId: v.id("employees"),
    date: v.string(),
    amount: v.number(),
    note: v.optional(v.string()),
  })
    .index("by_employee_date", ["employeeId", "date"])
    .index("by_date", ["date"]),

  // A week's pay, saved when it is paid out: pay − cash advances − last
  // week's utang. Anything still owed carries over to the next week.
  payslips: defineTable({
    employeeId: v.id("employees"),
    weekStart: v.string(), // the Monday
    days: v.number(),
    gross: v.number(), // days × daily rate
    advances: v.number(), // cash advances this week
    previousDebt: v.number(), // utang carried over from the week before
    paidOut: v.number(), // handed to the worker
    carryOver: v.number(), // utang left, taken off next week's pay
  })
    .index("by_employee_week", ["employeeId", "weekStart"])
    .index("by_week", ["weekStart"]),

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
