declare module 'decimal.js-light' {
  const Decimal: any;
  export default Decimal;
}

declare module 'decimal.js-light/decimal.js' {
  import Decimal from 'decimal.js-light';
  export default Decimal;
}
