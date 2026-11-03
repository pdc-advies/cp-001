import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { isDemo } from '@/lib/demo'
import { AFZENDER, BELASTINGEN } from '@/lib/invoicing'
import { StatusBadge, eur, fmtDate } from '@/components/InvoiceStatus'
import MessageList from '@/components/MessageList'
import PrintButton from '@/components/PrintButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Factuur · Contract Register' }

// Het factuurdocument zoals de klant het krijgt, plus de koppelingsberichten van deze factuur
export default async function InvoicePage({ params }) {
  if (!isDemo()) notFound()
  const id = parseInt((await params).id)
  const invoice = await prisma.invoice.findFirst({ where: { id } })
  if (!invoice) notFound()
  const [customer, messages, original] = await Promise.all([
    invoice.debiteurnummer ? prisma.customer.findFirst({ where: { debiteurnummer: invoice.debiteurnummer } }) : null,
    prisma.interfaceMessage.findMany({ where: { invoiceId: id }, orderBy: { id: 'asc' } }),
    invoice.creditOfId ? prisma.invoice.findFirst({ where: { id: invoice.creditOfId } }) : null,
  ])
  const credit = Boolean(invoice.creditOfId)
  const concept = invoice.status === 'aangemaakt' || invoice.status === 'verzonden'

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3 print:hidden">
        <Link href={`/contracts/${invoice.contractId}#facturatie`} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Naar het contract">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{credit ? 'Creditfactuur' : 'Factuur'} {invoice.unit4Number ?? `CP001-${invoice.id}`}</h1>
          <p className="text-sm text-gray-500">{invoice.contractNumber} · {invoice.periodLabel}</p>
        </div>
        <span className="ml-auto flex items-center gap-3">
          <StatusBadge status={invoice.status} />
          <PrintButton />
        </span>
      </div>

      <article className="relative bg-white rounded-xl border border-gray-200 p-10 text-sm text-gray-800 print:border-0 print:p-0">
        {concept && (
          <p className="absolute top-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md bg-amber-50 text-amber-800 text-xs font-medium">
            Concept: het factuurnummer volgt bij boeking in Unit4
          </p>
        )}
        <div className="flex justify-between gap-8">
          <div className="pt-16">
            <p className="font-medium">{invoice.customerName}</p>
            {customer?.address && <p>{customer.address}</p>}
            {customer?.city && <p>{customer.city}</p>}
          </div>
          <div className="text-right text-xs text-gray-600">
            <p className="text-base font-semibold text-gray-900">{AFZENDER.naam}</p>
            {AFZENDER.adres.map((r) => <p key={r}>{r}</p>)}
            <p className="mt-2">IBAN {AFZENDER.iban}</p>
            <p>BTW {AFZENDER.btw} · KvK {AFZENDER.kvk}</p>
          </div>
        </div>

        <h2 className="mt-10 text-2xl font-semibold text-gray-900">{credit ? 'Creditfactuur' : 'Factuur'}</h2>
        <dl className="mt-4 grid grid-cols-[max-content_1fr_max-content_1fr] gap-x-6 gap-y-1 text-xs">
          <dt className="text-gray-500">Factuurnummer</dt><dd>{invoice.unit4Number ?? '—'}</dd>
          <dt className="text-gray-500">Debiteurnummer</dt><dd>{invoice.debiteurnummer ?? '—'}</dd>
          <dt className="text-gray-500">Factuurdatum</dt><dd>{fmtDate(invoice.invoiceDate)}</dd>
          <dt className="text-gray-500">Contract</dt><dd>{invoice.contractNumber}</dd>
          <dt className="text-gray-500">Vervaldatum</dt><dd>{credit ? '—' : fmtDate(invoice.dueDate)}</dd>
          <dt className="text-gray-500">Periode</dt><dd>{fmtDate(invoice.periodStart)} t/m {fmtDate(invoice.periodEnd)}</dd>
          {invoice.customerReference && (<><dt className="text-gray-500">Uw referentie</dt><dd className="col-span-3">{invoice.customerReference}</dd></>)}
          {invoice.type === 'belasting' && (
            <>
              <dt className="text-gray-500">Aanslag</dt>
              <dd className="col-span-3">
                {BELASTINGEN[invoice.taxType]?.label} aanslagjaar {invoice.taxYear}, ontvangen {fmtDate(invoice.taxReceivedAt)}{invoice.taxReference && `, nummer ${invoice.taxReference}`}
              </dd>
            </>
          )}
          {original && (<><dt className="text-gray-500">Crediteert</dt><dd className="col-span-3">Factuur {original.unit4Number ?? `CP001-${original.id}`}</dd></>)}
        </dl>

        <table className="mt-8 w-full">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-300">
              <th className="py-2 text-left font-medium">Omschrijving</th>
              <th className="py-2 text-right font-medium">Bedrag</th>
              <th className="py-2 text-right font-medium">BTW %</th>
              <th className="py-2 text-right font-medium">BTW</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, n) => (
              <tr key={n} className="border-b border-gray-100">
                <td className="py-2 pr-4">{l.omschrijving}</td>
                <td className="py-2 text-right tabular-nums">{eur(l.bedrag)}</td>
                <td className="py-2 text-right tabular-nums">{l.btwPct}%</td>
                <td className="py-2 text-right tabular-nums">{eur(l.btw)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 ml-auto w-64 space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Subtotaal</span><span className="tabular-nums">{eur(invoice.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">BTW</span><span className="tabular-nums">{eur(invoice.vatAmount)}</span></div>
          <div className="flex justify-between font-semibold border-t border-gray-300 pt-1"><span>Totaal</span><span className="tabular-nums">{eur(invoice.total)}</span></div>
        </div>

        <p className="mt-10 text-xs text-gray-600">
          {credit
            ? 'Dit bedrag wordt verrekend met de oorspronkelijke factuur.'
            : `Wij verzoeken u ${eur(invoice.total)} vóór ${fmtDate(invoice.dueDate)} over te maken op ${AFZENDER.iban}, onder vermelding van het factuurnummer.`}
        </p>
        {invoice.status === 'betaald' && <p className="mt-2 text-xs text-green-700 print:hidden">Betaald op {fmtDate(invoice.paidAt)} (gemeld door Unit4).</p>}
      </article>

      <section className="bg-white rounded-xl border border-gray-200 p-5 print:hidden">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">Koppeling met Unit4</h2>
        <MessageList messages={JSON.parse(JSON.stringify(messages))} />
      </section>
    </div>
  )
}
