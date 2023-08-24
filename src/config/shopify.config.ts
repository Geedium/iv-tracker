import Shopify from 'shopify-api-node';

import { LATEST_API_VERSION } from '@shopify/shopify-api';

// Initialize the Shopify API with your credentials
const shopify = new Shopify({
    shopName: "",
    apiVersion: LATEST_API_VERSION,
    accessToken: "",
});

shopify.on('callLimits', (limits) => {
    console.log(limits)
});

export default shopify;
