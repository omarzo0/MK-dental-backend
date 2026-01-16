const nodemailer = require("nodemailer");

// Create reusable transporter object using Brevo SMTP
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// Helper to send email
const sendEmail = async ({ to, subject, html }) => {
    try {
        const info = await transporter.sendMail({
            from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
            to,
            subject,
            html,
        });

        console.log("Message sent: %s", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending email:", error);
        // Don't throw error to prevent blocking main flows (e.g. order creation)
        return null;
    }
};

const sendPasswordResetEmail = async (email, resetToken) => {
    // In production, this would be a proper frontend URL
    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

    const message = `
    <h1>Password Reset Request</h1>
    <p>You have requested a password reset. Please click the link below to reset your password:</p>
    <a href="${resetUrl}" clicktracking=off>${resetUrl}</a>
    <p>This link will expire in 1 hour.</p>
    <p>If you did not request this, please ignore this email.</p>
  `;

    return sendEmail({
        to: email,
        subject: "MK Dental - Password Reset",
        html: message,
    });
};

const sendAdminPasswordResetEmail = async (email, resetToken, adminName) => {
    const resetUrl = `${process.env.ADMIN_URL || "http://localhost:3000/admin"}/reset-password?token=${resetToken}`;

    const message = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
            .warning { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>MK Dental Admin</h1>
            </div>
            <div class="content">
                <h2>Password Reset Request</h2>
                <p>Hello ${adminName || "Admin"},</p>
                <p>We received a request to reset your admin account password. Click the button below to reset it:</p>
                <p style="text-align: center;">
                    <a href="${resetUrl}" class="button" style="color: white;">Reset Password</a>
                </p>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
                <div class="warning">
                    <strong>⚠️ Security Notice:</strong>
                    <p>This link will expire in <strong>1 hour</strong>. If you did not request this password reset, please ignore this email or contact support immediately.</p>
                </div>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} MK Dental. All rights reserved.</p>
                <p>This is an automated message, please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    return sendEmail({
        to: email,
        subject: "MK Dental Admin - Password Reset Request",
        html: message,
    });
};

const sendAdminOtpEmail = async (email, otp, adminName) => {
    const message = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp-box { background-color: #ffffff; border: 2px dashed #2563eb; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb; margin: 10px 0; }
            .footer { margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
            .warning { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-top: 20px; }
            .timer { color: #ef4444; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 MK Dental Admin</h1>
            </div>
            <div class="content">
                <h2>Password Reset OTP</h2>
                <p>Hello ${adminName || "Admin"},</p>
                <p>You have requested to reset your password. Use the following OTP code to proceed:</p>
                
                <div class="otp-box">
                    <p style="margin: 0; color: #6b7280;">Your verification code is:</p>
                    <p class="otp-code">${otp}</p>
                </div>
                
                <p class="timer">⏱️ This code expires in 10 minutes.</p>
                
                <div class="warning">
                    <strong>⚠️ Security Notice:</strong>
                    <p style="margin: 5px 0 0 0;">If you did not request this password reset, please ignore this email or contact support immediately. Never share this code with anyone.</p>
                </div>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} MK Dental. All rights reserved.</p>
                <p>This is an automated message, please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    return sendEmail({
        to: email,
        subject: `🔐 Your MK Dental Admin Password Reset Code: ${otp}`,
        html: message,
    });
};


const sendOrderConfirmationEmail = async (order) => {
    const orderUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/orders/${order._id}`;

    const itemsHtml = order.items
        .map(
            (item) => `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                    <div style="display: flex; align-items: center;">
                        ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 12px;">` : ''}
                        <span>${item.name}</span>
                    </div>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.price.toFixed(2)} EGP</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.subtotal.toFixed(2)} EGP</td>
            </tr>
            `
        )
        .join("");

    const message = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
            .order-info { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .order-number { font-size: 20px; font-weight: bold; color: #2563eb; }
            .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .table th { background-color: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; }
            .totals { background-color: #f9fafb; padding: 15px; border-radius: 8px; }
            .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
            .totals-row.total { font-weight: bold; font-size: 18px; border-top: 2px solid #e5e7eb; padding-top: 12px; margin-top: 8px; }
            .address-box { background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 10px 0; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
            .success-icon { font-size: 48px; margin-bottom: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="success-icon">✓</div>
                <h1>Order Confirmed!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Thank you for your purchase</p>
            </div>
            <div class="content">
                <div class="order-info">
                    <p style="margin: 0;">Order Number:</p>
                    <p class="order-number">#${order.orderNumber}</p>
                    <p style="margin: 10px 0 0 0; color: #6b7280;">Placed on ${new Date(order.createdAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                
                <p>Hi ${order.customer.firstName},</p>
                <p>We've received your order and it's being processed. Here's a summary of your purchase:</p>
                
                <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Order Items</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th style="text-align: center;">Qty</th>
                            <th style="text-align: right;">Price</th>
                            <th style="text-align: right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                
                <div class="totals">
                    <div class="totals-row">
                        <span>Subtotal:</span>
                        <span>${order.totals.subtotal.toFixed(2)} EGP</span>
                    </div>
                    <div class="totals-row">
                        <span>Shipping:</span>
                        <span>${order.totals.shipping.toFixed(2)} EGP</span>
                    </div>
                    ${order.totals.discount > 0 ? `
                    <div class="totals-row" style="color: #059669;">
                        <span>Discount:</span>
                        <span>-${order.totals.discount.toFixed(2)} EGP</span>
                    </div>
                    ` : ''}
                    <div class="totals-row total">
                        <span>Total:</span>
                        <span>${order.totals.total.toFixed(2)} EGP</span>
                    </div>
                </div>
                
                <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-top: 30px;">Shipping Address</h3>
                <div class="address-box">
                    <p style="margin: 0;">${order.customer.firstName} ${order.customer.lastName}</p>
                    <p style="margin: 5px 0;">${order.shippingAddress.street}</p>
                    <p style="margin: 5px 0;">${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}</p>
                    <p style="margin: 5px 0 0 0;">${order.shippingAddress.country}</p>
                </div>
                
                <p style="text-align: center; margin-top: 30px;">
                    <a href="${orderUrl}" class="button" style="color: white;">View Order Details</a>
                </p>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    We'll send you another email when your order ships. If you have any questions, please contact our support team.
                </p>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} MK Dental. All rights reserved.</p>
                <p>This is an automated message, please do not reply directly to this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    return sendEmail({
        to: order.customer.email,
        subject: `✓ Order Confirmed #${order.orderNumber} - MK Dental`,
        html: message,
    });
};

const sendNewOrderAdminNotification = async (order, adminEmail) => {
    const adminOrderUrl = `${process.env.ADMIN_URL || "http://localhost:3000/admin"}/orders/${order._id}`;

    const itemsHtml = order.items
        .map(
            (item) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.subtotal.toFixed(2)} EGP</td>
            </tr>
            `
        )
        .join("");

    const message = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #059669; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { background-color: #ffffff; padding: 25px; border: 1px solid #e5e7eb; }
            .alert-box { background-color: #ecfdf5; border: 1px solid #059669; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .order-summary { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 15px 0; }
            .customer-info { background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .table th { background-color: #f3f4f6; padding: 10px; text-align: left; font-weight: 600; font-size: 13px; }
            .total-row { font-weight: bold; font-size: 16px; background-color: #f0fdf4; }
            .button { display: inline-block; background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
            .footer { background-color: #f9fafb; padding: 15px; text-align: center; font-size: 11px; color: #6b7280; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
            .badge-pending { background-color: #fef3c7; color: #92400e; }
            .badge-paid { background-color: #d1fae5; color: #065f46; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🛒 New Order Received!</h1>
            </div>
            <div class="content">
                <div class="alert-box">
                    <strong>📦 Order #${order.orderNumber}</strong>
                    <p style="margin: 5px 0 0 0;">A new order has been placed and requires your attention.</p>
                </div>
                
                <div class="customer-info">
                    <h4 style="margin: 0 0 10px 0;">👤 Customer Information</h4>
                    <p style="margin: 5px 0;"><strong>Name:</strong> ${order.customer.firstName} ${order.customer.lastName}</p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${order.customer.email}</p>
                    ${order.customer.phone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${order.customer.phone}</p>` : ''}
                </div>
                
                <div class="order-summary">
                    <h4 style="margin: 0 0 10px 0;">📋 Order Details</h4>
                    <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                    <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${order.paymentMethod || 'Not specified'}</p>
                    <p style="margin: 5px 0;">
                        <strong>Payment Status:</strong> 
                        <span class="badge ${order.paymentStatus === 'paid' ? 'badge-paid' : 'badge-pending'}">${order.paymentStatus.toUpperCase()}</span>
                    </p>
                    <p style="margin: 5px 0;">
                        <strong>Order Status:</strong> 
                        <span class="badge badge-pending">${order.status.toUpperCase()}</span>
                    </p>
                </div>
                
                <h4 style="margin: 20px 0 10px 0;">🛍️ Ordered Items</h4>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th style="text-align: center;">Qty</th>
                            <th style="text-align: right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                        <tr class="total-row">
                            <td colspan="2" style="padding: 12px;"><strong>Total</strong></td>
                            <td style="padding: 12px; text-align: right;"><strong>${order.totals.total.toFixed(2)} EGP</strong></td>
                        </tr>
                    </tbody>
                </table>
                
                <h4 style="margin: 20px 0 10px 0;">📍 Shipping Address</h4>
                <div style="background-color: #f9fafb; padding: 12px; border-radius: 6px;">
                    <p style="margin: 0;">${order.shippingAddress.street}</p>
                    <p style="margin: 5px 0;">${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}</p>
                    <p style="margin: 0;">${order.shippingAddress.country}</p>
                </div>
                
                <p style="text-align: center; margin-top: 25px;">
                    <a href="${adminOrderUrl}" class="button" style="color: white;">View Order in Dashboard</a>
                </p>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} MK Dental Admin. This is an automated notification.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    return sendEmail({
        to: adminEmail,
        subject: `🛒 New Order #${order.orderNumber} - ${order.totals.total.toFixed(2)} EGP`,
        html: message,
    });
};

const sendOrderStatusUpdateEmail = async (order) => {
    const orderUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/orders/${order._id}`;

    // Status-specific messaging and colors
    const statusConfig = {
        pending: { color: "#f59e0b", icon: "⏳", title: "Order Pending", message: "Your order is waiting to be processed." },
        processing: { color: "#3b82f6", icon: "⚙️", title: "Order Processing", message: "We're preparing your order for shipment." },
        confirmed: { color: "#10b981", icon: "✓", title: "Order Confirmed", message: "Your order has been confirmed and will be shipped soon." },
        shipped: { color: "#8b5cf6", icon: "📦", title: "Order Shipped", message: "Your order is on its way!" },
        delivered: { color: "#059669", icon: "🎉", title: "Order Delivered", message: "Your order has been delivered successfully." },
        completed: { color: "#059669", icon: "✅", title: "Order Completed", message: "Thank you for shopping with us!" },
        cancelled: { color: "#ef4444", icon: "❌", title: "Order Cancelled", message: "Your order has been cancelled." },
        returned: { color: "#6b7280", icon: "↩️", title: "Order Returned", message: "Your return has been processed." },
    };

    const config = statusConfig[order.status] || statusConfig.pending;

    const message = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${config.color}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .status-icon { font-size: 48px; margin-bottom: 10px; }
            .content { background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
            .order-info { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .order-number { font-size: 18px; font-weight: bold; color: ${config.color}; }
            .status-badge { display: inline-block; background-color: ${config.color}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin: 10px 0; }
            .tracking-box { background-color: #eff6ff; border: 1px solid #3b82f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background-color: ${config.color}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="status-icon">${config.icon}</div>
                <h1>${config.title}</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">${config.message}</p>
            </div>
            <div class="content">
                <div class="order-info">
                    <p style="margin: 0;">Order Number:</p>
                    <p class="order-number">#${order.orderNumber}</p>
                    <p style="margin: 10px 0 0 0;">
                        <span class="status-badge">${order.status.toUpperCase()}</span>
                    </p>
                </div>
                
                <p>Hi ${order.customer.firstName},</p>
                <p>${config.message}</p>
                
                ${order.trackingNumber ? `
                <div class="tracking-box">
                    <h4 style="margin: 0 0 10px 0; color: #3b82f6;">📍 Tracking Information</h4>
                    <p style="margin: 0;"><strong>Tracking Number:</strong> ${order.trackingNumber}</p>
                </div>
                ` : ''}
                
                <p style="text-align: center; margin-top: 30px;">
                    <a href="${orderUrl}" class="button" style="color: white;">View Order Details</a>
                </p>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    If you have any questions about your order, please contact our support team.
                </p>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} MK Dental. All rights reserved.</p>
                <p>This is an automated message, please do not reply directly to this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    return sendEmail({
        to: order.customer.email,
        subject: `${config.icon} ${config.title} - Order #${order.orderNumber}`,
        html: message,
    });
};


module.exports = {
    sendEmail,
    sendPasswordResetEmail,
    sendAdminPasswordResetEmail,
    sendAdminOtpEmail,
    sendOrderConfirmationEmail,
    sendNewOrderAdminNotification,
    sendOrderStatusUpdateEmail,
};
