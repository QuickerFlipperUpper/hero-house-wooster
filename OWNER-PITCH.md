# Hero House owner presentation

Share `owner.html` as the sales presentation. It links to the customer website's ordering demonstration at `./#order-demo`.

## A practical walkthrough

1. Open the owner page: the idea is to order before arrival and collect at the drive-through window.
2. Use “Build a demo order.” Choose a sandwich, size, approved options, side/drink, drive-through pickup, and time.
3. Return to the owner page's kitchen ticket. The demo saved in this browser appears there; demonstrate Received → Preparing → Ready.
4. Compare the phone/window example with the proposed process. Ask the owner to confirm the current flow, kitchen ticket method, and rush capacity.
5. Enter the owner's actual pickup volume, average ticket, costs, and processor/provider fees in the calculator.
6. Try Zero growth. Show that migrating an existing phone order online alone is not extra revenue. Staff attention is separate from cash profit.
7. Agree on a limited pickup pilot and measure completed orders, contribution, and drive-through handoff performance before extending it.

## What the conservative example says

The starting example is **not Hero House's measured performance or a quoted project price**. It assumes 30 current pickup orders/day, 22 open days/month, $15 current average order, 25% of existing orders moving online, 1 genuinely new daily order, $0.75 additional add-on sales per online order, 40% variable cost, equal current and online processing of 2.9% + $0.30/order, $49/month service, and $1,200 setup spread over 12 months.

This yields $470.25 additional monthly revenue, $188.10 variable costs, $20.24 additional processing, and **$212.91 estimated additional monthly contribution** after the $49 service cost. After a $100 monthly setup allocation the example is $112.91. Simple setup payback is approximately 5.6 months if the monthly contribution repeats. Those results depend entirely on the assumptions; real profit is unknown.

Zero growth sets new orders and add-on lift to zero. At equal effective card fees, that means $0 extra sales and $0 processing difference: the service cost remains $49/month, and the $100 setup allocation makes the comparison −$149/month. Potential staff attention freed is 5.5 hours/month; no wage saving is claimed.

The model counts the complete processing cost on new orders. For existing orders moving online, it deducts only the change relative to the current effective POS processing cost, including fees on extra add-ons. Existing base sales are never counted as new revenue. It shows additional contribution, not accounting net profit; tax, tips, and costs not entered are excluded. Every formula is disclosed on the page.

## What is demonstrated and what a launch requires

The cart, confirmation, kitchen ticket, and ticket status are browser simulations. They do not charge a card, notify staff, reserve an actual pickup slot, or create a real order. The current host is static GitHub Pages.

A production launch needs owner-approved menu/taxes/modifiers, an ordering provider and payment setup, accepted-order routing to the existing POS or printer/KDS, capacity-aware slots and prep times, ready confirmation, drive-through instructions, and rules for pausing orders, refunds, delayed pickup, and no-shows. Choose these with the owner after confirming the existing equipment and workflow.

## Primary sources used

- Hero House's public menu/contact source: https://www.facebook.com/p/Hero-House-61589136044433/
- National Restaurant Association, *Restaurant Technology Landscape Report 2024*, printed p. 9: 68% of limited-service customers say they would likely order/pay on a restaurant website before pickup. National stated interest; not a local conversion rate or revenue forecast. https://go.restaurant.org/rs/078-ZLA-461/images/NatRestAssoc_TechLandscapeReport_2024.pdf
- Square pickup documentation: schedules, prep controls, and maximum orders per 15-minute pickup window. Product capability example; not a provider recommendation or current Hero House integration. https://squareup.com/help/us/en/article/8608-set-up-pickup-options-for-your-online-ordering-profile
- Square KDS routing documentation: routing online orders to kitchen displays requires compatible plan/device setup. https://squareup.com/help/us/en/article/7959-route-orders-with-your-kds

## Arithmetic checks performed

The pure `calculateOpportunity` function in `owner.js` is exported for Node and browser initialization is guarded. Six meaningful cases were checked: migration with equal fees and no lift; zero growth with service/setup; one genuinely new order/day; processing rate/fixed-fee difference on migrated orders; add-on lift without new base orders; and nonviable per-order margin. No external financial API is used.
