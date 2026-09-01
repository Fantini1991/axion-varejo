import RecordCrudPage, { type FieldDef } from "../../components/RecordCrudPage";
import { useOptionList } from "../../hooks/useOptionList";
import { calcularTotaisPedido, type PedidoCompra } from "../compras/PedidosCompra";

const CATEGORIAS = ["Compra de mercadoria", "Frete", "Impostos", "Serviços", "Despesa operacional", "Outros"];
const FORMAS_PAGAMENTO = ["Boleto", "Transferência", "Pix", "Cartão", "Dinheiro", "Cheque"];

export default function ContasPagar() {
  const fornecedorOptions = useOptionList("fornecedores", data => String(data.nome ?? ""));
  const pedidoOptions = useOptionList("pedidos-compra", data => {
    const p = data as unknown as PedidoCompra;
    const { total } = calcularTotaisPedido(p);
    const dataFmt = p.dataEmissao ? new Date(p.dataEmissao).toLocaleDateString("pt-BR") : "—";
    return `${p.fornecedor} — ${dataFmt} — ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
  });

  const fields: FieldDef[] = [
    { key: "descricao", label: "Descrição", type: "text", required: true, span2: true },
    { key: "fornecedor", label: "Fornecedor", type: "select", required: true, options: fornecedorOptions },
    { key: "valor", label: "Valor (R$)", type: "number", required: true },
    { key: "vencimento", label: "Vencimento", type: "date", required: true },
    { key: "status", label: "Status", type: "select", required: true, options: ["Pendente", "Pago", "Atrasado"] },
    { key: "formaPagamento", label: "Forma de pagamento", type: "select", options: FORMAS_PAGAMENTO },
    { key: "categoria", label: "Categoria", type: "select", options: CATEGORIAS },
    { key: "dataPagamento", label: "Data do pagamento", type: "date" },
    { key: "pedidoCompra", label: "Pedido de compra vinculado", type: "select", options: pedidoOptions, span2: true },
    { key: "parcela", label: "Parcela (ex: 1/3)", type: "text" },
  ];

  return (
    <RecordCrudPage
      entity="contas-pagar"
      breadcrumb="Financeiro"
      title="Contas a Pagar"
      description="Valores a pagar a fornecedores."
      fields={fields}
      columns={["descricao", "fornecedor", "categoria", "valor", "vencimento", "status"]}
      formatCell={(key, value) => {
        if (key === "valor") return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        if (key === "vencimento" && value) return new Date(String(value)).toLocaleDateString("pt-BR");
        return String(value ?? "—");
      }}
    />
  );
}
