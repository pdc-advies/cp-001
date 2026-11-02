// Facturatie en de Unit4-simulatie zijn alleen zichtbaar waar DEMO_MODE=1 staat (de demo-omgeving)
export const isDemo = () => process.env.DEMO_MODE === '1'
