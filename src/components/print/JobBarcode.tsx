'use client'

import Barcode from 'react-barcode'

export function JobBarcode({ value }: { value: string }) {
  return (
    <Barcode
      value={value}
      format="CODE128"
      width={1.4}
      height={55}
      fontSize={12}
      displayValue={true}
      background="#ffffff"
      lineColor="#000000"
      margin={0}
    />
  )
}
