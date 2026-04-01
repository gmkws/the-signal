/**
 * Shopify Storefront / Admin API service
 * Pulls product catalog, collections, and images from connected Shopify stores.
 */

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string | null;
  handle: string;
  product_type: string;
  vendor: string;
  tags: string;
  images: Array<{ id: number; src: string; alt: string | null }>;
  variants: Array<{
    id: number;
    price: string;
    compare_at_price: string | null;
    inventory_quantity: number;
  }>;
  status: string;
}

interface ShopifyCollection {
  id: number;
  title: string;
  handle: string;
}

interface ShopifyProductWithCollections {
  product: ShopifyProduct;
  collections: string[];
}

/**
 * Fetch products from a Shopify store using the Admin API
 */
export async function fetchShopifyProducts(
  shopDomain: string,
  accessToken: string,
  limit = 50
): Promise<ShopifyProduct[]> {
  const url = `https://${shopDomain}/admin/api/2024-01/products.json?limit=${limit}&status=active`;

  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.products || [];
}

/**
 * Fetch collections from a Shopify store
 */
export async function fetchShopifyCollections(
  shopDomain: string,
  accessToken: string
): Promise<ShopifyCollection[]> {
  const customUrl = `https://${shopDomain}/admin/api/2024-01/custom_collections.json?limit=50`;
  const smartUrl = `https://${shopDomain}/admin/api/2024-01/smart_collections.json?limit=50`;

  const [customRes, smartRes] = await Promise.all([
    fetch(customUrl, {
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
    }),
    fetch(smartUrl, {
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
    }),
  ]);

  const customData = customRes.ok ? await customRes.json() : { custom_collections: [] };
  const smartData = smartRes.ok ? await smartRes.json() : { smart_collections: [] };

  return [
    ...(customData.custom_collections || []),
    ...(smartData.smart_collections || []),
  ];
}

/**
 * Fetch which collections a product belongs to
 */
export async function fetchProductCollections(
  shopDomain: string,
  accessToken: string,
  productId: number
): Promise<string[]> {
  try {
    const url = `https://${shopDomain}/admin/api/2024-01/collects.json?product_id=${productId}`;
    const response = await fetch(url, {
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
    });
    if (!response.ok) return [];
    const data = await response.json();
    // We'd need to resolve collection IDs to names, but for simplicity return IDs
    return (data.collects || []).map((c: any) => c.collection_id.toString());
  } catch {
    return [];
  }
}

/**
 * Validate a Shopify connection by fetching shop info
 */
export async function validateShopifyConnection(
  shopDomain: string,
  accessToken: string
): Promise<{ valid: boolean; shopName?: string; error?: string }> {
  try {
    const url = `https://${shopDomain}/admin/api/2024-01/shop.json`;
    const response = await fetch(url, {
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}: Invalid credentials or domain` };
    }

    const data = await response.json();
    return { valid: true, shopName: data.shop?.name };
  } catch (error: any) {
    return { valid: false, error: error.message || "Connection failed" };
  }
}

/**
 * Transform a Shopify product into our database format
 */
export function transformShopifyProduct(product: ShopifyProduct, brandId: number, collections: string[] = []) {
  const primaryVariant = product.variants?.[0];
  return {
    brandId,
    shopifyProductId: product.id.toString(),
    title: product.title,
    description: product.body_html ? stripHtml(product.body_html) : null,
    handle: product.handle,
    productType: product.product_type || null,
    vendor: product.vendor || null,
    tags: product.tags ? product.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    imageUrl: product.images?.[0]?.src || null,
    images: product.images?.map((img: any) => img.src) || [],
    price: primaryVariant?.price || null,
    compareAtPrice: primaryVariant?.compare_at_price || null,
    inventoryQuantity: primaryVariant?.inventory_quantity ?? null,
    collections,
    status: product.status === "active" ? "active" : "draft",
  };
}

/** Strip HTML tags from a string */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
