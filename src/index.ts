import dotenv from 'dotenv';
dotenv.config();

import ngrok from "ngrok";

import express from "express";

import "@shopify/shopify-api/adapters/node";
import { LATEST_API_VERSION } from "@shopify/shopify-api";

import Shopify from "shopify-api-node";

const PORT = 5000;

// const migrateProductsFromShopify = (src: Shopify.IProduct[], dest: any[]) => {
//     const startTime = process.hrtime();

//     const endTime = process.hrtime(startTime);
//     const elapsedSeconds = (endTime[0] + endTime[1] / 1e9).toFixed(2);
//     console.log(
//         `i Migration (Shopify -> OpenCart) completed in ${elapsedSeconds} seconds`
//     );
// };

// const migrateProductsFromOpenCart = (src: any, dest: Shopify.IProduct[]) => {
//     const startTime = process.hrtime();

//     const endTime = process.hrtime(startTime);
//     const elapsedSeconds = (endTime[0] + endTime[1] / 1e9).toFixed(2);
//     console.log(
//         `i Migration (OpenCart -> Shopify) completed in ${elapsedSeconds} seconds`
//     );
// };

async function handler() {
    if (!process.env.SHOPIFY_STORE_URL || !process.env.SHOPIFY_ACCESS_TOKEN
        || !process.env.SHOPIFY_STORE_URL_2 || !process.env.SHOPIFY_ACCESS_TOKEN_2) {
        throw new Error("ERROR: BAD ENV VARIABLES!");
    }

    const url = await ngrok.connect({
        addr: "5000",
        authtoken: process.env.NGROK_AUTH_TOKEN,
    });

    // Initialize the Shopify API with your credentials
    const shopify = new Shopify({
        shopName: process.env.SHOPIFY_STORE_URL,
        apiVersion: process.env.LATEST_API_VERSION,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    });

    // Cleanup existing webhooks
    let webhooks = await shopify.webhook.list();
    console.log(`i Shopify Webhook GC: `, webhooks.length);
    for (let i = 0; i < webhooks.length; i++) {
        await shopify.webhook.delete(webhooks[i].id);
        console.log(
            `i Removed webhook with id: ${webhooks[i].id} and event ${webhooks[i].topic}`
        );
    }

    await shopify.webhook.create({
        topic: "products/update",
        format: "json",
        address: `${url}/webhook-a/update`,
    });

    console.log(
        `i Webhook created (products/update): ${url}/webhook-a/update - POST`
    );

    const shopify2 = new Shopify({
        shopName: process.env.SHOPIFY_STORE_URL_2,
        apiVersion: LATEST_API_VERSION,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN_2,
    });

    // C2
    webhooks = await shopify2.webhook.list();
    console.log(`i Shopify2 Webhook GC: `, webhooks.length);
    for (let i = 0; i < webhooks.length; i++) {
        await shopify2.webhook.delete(webhooks[i].id);
        console.log(
            `i Removed webhook with id: ${webhooks[i].id} and event ${webhooks[i].topic}`
        );
    }

    await shopify2.webhook.create({
        topic: "products/update",
        format: "json",
        address: `${url}/webhook-a/update`,
    });

    console.log(
        `i Webhook created (products/update): ${url}/webhook-a/update - POST`
    );

    // shopify.on('callLimits', (limits) => console.log(limits));

    const app = express();
    app.use(express.json());

    app.get("/webhook", async (req, res) => {
        try {
            // Fetch all products from your store
            const products = await shopify.product.list();

            // Loop through each product and update the inventory count for each variant
            for await (const product of products) {
                // Set the new inventory count here (e.g., setting it to 1)
                const newInventoryCount = 0;

                // Get the inventory item IDs for the product variants
                const inventoryItemIds = product.variants.map(
                    (variant) => variant.inventory_item_id
                );

                // Update the inventory levels for each variant using the inventory item IDs
                await Promise.all(
                    inventoryItemIds.map((inventoryItemId) =>
                        shopify.inventoryLevel.set({
                            inventory_item_id: inventoryItemId,
                            available: newInventoryCount,
                            location_id: 83508265292,
                        })
                    )
                );

                console.log(`Inventory count updated for product ${product.id}.`);
            }

            console.log("Inventory count updated for all products.");
            res.status(200).json({ updated: 1 });
        } catch (error) {
            // @ts-ignore
            console.error(
                "Error updating inventory count:",
                // @ts-ignore
                error.message,
                // @ts-ignore
                error.response?.body
            );
            res.status(500).json({ ok: false });
        }
    });

    app.post("/", (req, res) => {
        console.log("CATCHED!");
    });

    function BI_DIR(shop: string) {
        switch (shop) {
            case process.env.SHOPIFY_STORE_URL:
                return shopify2;
            default:
                return shopify;
        }
    }

    app.post("/webhook-a/update", async (req, res) => {
        // By directional correlation
        const shop = req.headers["x-shopify-shop-domain"];
        if (!shop || typeof shop !== "string") {
            console.warn("x Unindentified shop?!");
            res.status(500).json({ ok: false, message: "Vendor is not Seiko." });
            return;
        }
        const { vendor, variants } = req.body;
        if (vendor !== "Seiko") {
            console.warn("x Product update vendor is not Seiko.");
            res.status(500).json({ ok: false, message: "Vendor is not Seiko." });
            return;
        }

        const instance = BI_DIR(shop);

        // Take first in variant as default variant
        const { sku, inventory_quantity } = variants[0];
        console.log(`Product ${sku}, quantity: ${inventory_quantity}`);

        // Fetch all products by SKU
        const products = await instance.product.list();
        console.log(`Shop 2 has ${products.length} products.`);

        // Fetch all locations
        const locations = await instance.location.list();
        const defaultLocation = locations[0];

        console.log("Default shop location is ", defaultLocation.address1);

        // Loop through each product and update the inventory count for each variant
        for await (const product of products) {
            const containsSKU = product.variants.some(
                (variant) => variant.sku == sku
            );
            if (!containsSKU) continue;

            // Get the inventory item IDs for the product variants
            const inventoryItemIds = product.variants.map(
                (variant) => variant.inventory_item_id
            );

            try {
                await Promise.all(
                    inventoryItemIds.map((inventoryItemId) =>
                        instance.inventoryLevel.set({
                            inventory_item_id: inventoryItemId,
                            available: inventory_quantity,
                            location_id: defaultLocation.id,
                        })
                    )
                );
                console.log(`Inventory count updated for product ${product.id}.`);
            } catch (err) {
                console.warn("Unable to update product variant!");
            }
        }

        res.status(200).json({ ok: true });
    });

    app.get("/", async (req, res) => {
        try {
            const parent = await shopify.product.list();

            const child = [];

            // Make sure parent SKUs are same as child SKUs

            res.status(200).json(parent);
        } catch (err) {
            console.error(
                `Failed to list products, error: ${err instanceof Error ? err.message : err
                }`
            );
            res.status(500).json({ ok: false });
        }
    });

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`i Shopify API ${LATEST_API_VERSION}`);
        console.log(`i Server listening on port ${PORT}`);
        console.log(`i Ngrok URL ${url}`);
    });
}

try {
    handler();
} catch (e) {
    e && e instanceof Error && console.warn(`Error occured: ${e.message}`);
}
