// controllers/orderController.js (Logic for POST /api/v1/orders)

// ... imports for Order and Book models

exports.createOrder = async (req, res, next) => {
    // req.user.id is available from the 'protect' middleware
    const { items, shippingAddress } = req.body; 

    try {
        // --- 1. Decrement Stock for each item ---
        for (const item of items) {
            // Use findOneAndUpdate with $inc for reliable, atomic decrement
            const book = await Book.findByIdAndUpdate(
                item.book,
                { $inc: { stockQuantity: -item.quantity } },
                { new: true }
            );

            if (!book || book.stockQuantity < 0) {
                // If stock drops below zero (race condition), or book not found, throw error
                // NOTE: In production, you would need more robust transaction handling here.
                throw new Error(`Insufficient stock for book ID: ${item.book}`);
            }
        }

        // --- 2. Create the Order ---
        const order = await Order.create({ 
            user: req.user.id, 
            items, 
            shippingAddress,
            // totalAmount will be calculated by the pre-save hook on the Order model
        }); 

        res.status(201).json({ success: true, data: order });

    } catch (error) {
        // --- 3. IMPORTANT: Handle Rollback/Cleanup on failure ---
        // If an error occurs during stock decrement or order creation, 
        // you must revert the stock changes that DID occur to avoid data corruption. 
        // This is where database transactions become critical in large apps.
        
        // Simplified error response:
        res.status(400).json({ success: false, error: error.message });
    }
};