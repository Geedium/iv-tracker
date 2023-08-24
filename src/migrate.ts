import OpenCart from "./OpenCart";
import { Product } from "./Product";
import shopify from "./config/shopify.config";

(async function () {
    const startTime = process.hrtime();

    // Remove all products shopify
    try {
        const productsCount = await shopify.product.count();
        const productsPerPage = 250;
        // Calculate the total number of pages required to display all products
        const pagesCount = Math.ceil(productsCount / productsPerPage);

        console.log(`Shopify has ${productsCount} products and ${pagesCount} pages.`);

        for (let page = 1; page <= pagesCount; page++) {
            const products = await shopify.product.list({
                limit: productsPerPage,
                fields: 'id'
            });
            console.log(`Pulled products ${products.length} from page ${page}`)
            for (const product of products) {
                await shopify.product.delete(product.id);
                console.log(`Removed product from Shopify database: ${product.id}`);
            }
        }

        console.log('All products have been deleted successfully.');

    } catch (error) {
        console.error('Error deleting products:', error);
    }

    const src = new OpenCart("...");
    const products = await src.list();

    for await (const product of products) {
        if (product.Manufacturer && product.Manufacturer?.name === "Seiko") {
            const collections: number[] = [];
            let tags = "";

            for (const cat of product.Category) {
                if (cat.name === "Laikrodžiai Vyrams") {
                    collections.push(604120940876);
                    tags = "men";
                } else if (cat.name === "Laikrodžiai Moterims") {
                    collections.push(604087189836);
                    tags = "women";
                }
            }

            if (product.Title.trim().startsWith("Seiko 5 Sports")) {
                collections.push(606076043596);
            }
            if (product.Title.trim().startsWith("Seiko Presage")) {
                collections.push(606076141900);
            }

            const createdProduct = await shopify.product.create({
                title: product.Title,
                body_html: `
                    <p>${product.Description}</p>
                    ${product._attributes && product._attributes.map(attrib => {
                    return `${attrib.name}<br />${attrib.text}<br /><br />`
                })}
                `,
                vendor: product.Manufacturer.name,
                // product_type: 'Watches',
                variants: [
                    product.Special ? {
                        compare_at_price: Number(product.Price),
                        price: Number(product.Special),
                        sku: product.SKU,
                        inventory_quantity: Number(product.Quantity),
                        inventory_management: 'shopify', // Track inventory in Shopify
                    } : {
                        price: Number(product.Price),
                        sku: product.SKU,
                        inventory_quantity: Number(product.Quantity),
                        inventory_management: 'shopify', // Track inventory in Shopify
                    }
                ],
                tags,
                collections,
                images: [
                    {
                        src: product.Extra_image_1,
                        variant_ids: [],
                    },
                    ...product._images.map(image => {
                        return {
                            src: image,
                            variant_ids: [],
                        };
                    }),
                ],
            });
            console.log(`i Product ${product.Title} imported successfully! Tags: [${tags}]`);

            // Associate the product with the specified collections
            for (const collectionId of collections) {
                const collectionAssociation = await shopify.collect.create({
                    product_id: createdProduct.id,
                    collection_id: collectionId,
                });
                console.log(`Product added to collection ${collectionId}:`, collectionAssociation);
            }
        }
    }

    const endTime = process.hrtime(startTime);
    const elapsedSeconds = (endTime[0] + endTime[1] / 1e9).toFixed(2);
    console.log(`i Migration (OpenCart -> Shopify) completed in ${elapsedSeconds} seconds`);
})();
