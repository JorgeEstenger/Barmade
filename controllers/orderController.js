/**
 * Order HTTP handlers.
 */

const orderService = require('../services/orderService');

// GET /api/orders  (optional ?date=&from=&to=&channel=&limit=100&offset=0; newest first)
async function getOrders(req, res) {
  const { total, limit, offset, data } = await orderService.findOrders(req.query);
  res.status(200).json({ count: data.length, total, limit, offset, data });
}

// GET /api/orders/:id
async function getOrder(req, res) {
  res.status(200).json({ data: await orderService.getOrderById(req.params.id) });
}

// POST /api/orders
async function createOrder(req, res) {
  const { order, movements, alertsCreated, alertsResolved } = await orderService.createOrder(req.body);
  res.status(201).json({
    message: `Order ${order.id} created.`,
    data: order,
    consumed: order.consumed,
    movements,
    alertsCreated,
    alertsResolved,
  });
}

// PATCH /api/orders/:id/status
async function updateOrderStatus(req, res) {
  const order = await orderService.updateOrderStatus(req.params.id, req.body);
  res.status(200).json({ message: `Order ${order.id} status changed to ${order.status}.`, data: order });
}

module.exports = { getOrders, getOrder, createOrder, updateOrderStatus };
