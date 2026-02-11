exports.createOrder = async (req, res) => {
  const { items, userInfo } = req.body;

  if (!items || items.length === 0)
    return res.status(400).json({ success: false, error: "No items provided" });

  if (
    !userInfo?.name ||
    !userInfo?.email ||
    !userInfo?.phone ||
    !userInfo?.address
  )
    return res
      .status(400)
      .json({ success: false, error: "Incomplete user info" });

  try {
    const totalAmount = items.reduce(
      (sum, item) => sum + item.priceAtPurchase * item.quantity,
      0,
    );

    const order = await Order.create({
      items,
      userInfo,
      totalAmount,
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error.message);
    return res.status(500).json({
      success: false,
      error: "Server error while creating order",
    });
  }
};
