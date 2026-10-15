export const PLANS = Object.freeze({
  Basic: Object.freeze({
    code: "Basic",
    name: "Basic",
    price: 0,
    maxProperties: 1,
    maxPhotosPerProperty: 8,
    searchPriority: 0,
    advancedAnalytics: false,
    reportExports: false,
    specialOffers: false,
    description: "Everything needed to manage one property.",
  }),
  Advanced: Object.freeze({
    code: "Advanced",
    name: "Advanced",
    price: 999,
    maxProperties: 10,
    maxPhotosPerProperty: 200,
    searchPriority: 1,
    advancedAnalytics: true,
    reportExports: true,
    specialOffers: true,
    description: "More properties, priority discovery and deeper reporting.",
  }),
});

export const PLAN_NAMES = Object.freeze(Object.keys(PLANS));
export const planFor = (name) => PLANS[name] || PLANS.Basic;
export const publicPlans = () => Object.values(PLANS).map((plan) => ({ ...plan }));
