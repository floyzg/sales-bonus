/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  // purchase — одна запись из purchase_record.items
  const { discount, sale_price, quantity } = purchase;
  const factor = 1 - (Number(discount) || 0) / 100;
  return sale_price * quantity * factor;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  if (total <= 0) return 0;
  const profit = Number(seller.profit) || 0;
  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.1;
  if (index === total - 1) return 0;
  return profit * 0.05;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  // проверка входных данных
  if (
    !data ||
    !Array.isArray(data.sellers) ||
    !Array.isArray(data.products) ||
    !Array.isArray(data.purchase_records)
  ) {
    throw new Error("Неверные входные данные");
  }

  // проверка опций и функций
  if (!options || typeof options !== "object") {
    throw new Error("Не заданы опции");
  }
  const { calculateRevenue, calculateBonus } = options;
  if (
    typeof calculateRevenue !== "function" ||
    typeof calculateBonus !== "function"
  ) {
    throw new Error("Отсутствуют функции расчёта");
  }

  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
    bonus: 0,
    top_products: [],
  }));

  // создаем мапу для быстрого доступа к объектам продавцов и товаров
  const sellerIndex = Object.fromEntries(sellerStats.map((s) => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map((p) => [p.sku, p]));

  // обход всех чеков и подсчёт метрик
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return; // пропуск записи с неизвестным продавцом

    seller.sales_count += 1;
    seller.revenue += Number(record.total_amount) || 0;

    // себестоимость и реальная выручка по товарам
    record.items.forEach((item) => {
      const product = productIndex[item.sku];
      const cost =
        product && Number(product.purchase_price)
          ? product.purchase_price * item.quantity
          : 0;
      const itemRevenue = calculateRevenue(item, product);
      const itemProfit = itemRevenue - cost;
      seller.profit += itemProfit;

      // инкрементируем счётчик проданных товаровв
      if (!seller.products_sold[item.sku]) seller.products_sold[item.sku] = 0;
      seller.products_sold[item.sku] += item.quantity;
    });
  });

  sellerStats.sort((a, b) => b.profit - a.profit);

  const totalSellers = sellerStats.length;
  sellerStats.forEach((seller, index) => {
    const rawBonus = calculateBonus(index, totalSellers, seller);
    seller.bonus = +rawBonus.toFixed(2);

    // формируем топ-10
    const top = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((x, y) => y.quantity - x.quantity)
      .slice(0, 10);
    seller.top_products = top;
  });

  // итоговая коллекция
  return sellerStats.map((seller) => ({
    seller_id: seller.id,
    name: seller.name,
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: +seller.bonus.toFixed(2),
  }));
}
