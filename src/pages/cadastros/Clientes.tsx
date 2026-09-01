import RecordCrudPage, { type FieldDef } from "../../components/RecordCrudPage";

const fields: FieldDef[] = [
  { key: "nome", label: "Nome", type: "text", required: true },
  { key: "tipo", label: "Tipo", type: "select", required: true, options: ["Consumidor Final", "Empresa", "Profissional/Autônomo"] },
  { key: "contato", label: "Nome do contato", type: "text" },
  { key: "documento", label: "CPF/CNPJ", type: "text" },
  { key: "telefone", label: "Telefone", type: "text" },
  { key: "email", label: "E-mail", type: "text" },
  { key: "formaPagamento", label: "Forma de pagamento acordada", type: "select", options: ["Dinheiro", "Pix", "Cartão", "Boleto", "Transferência", "Cheque", "A combinar"] },
  { key: "pontualidade", label: "Pontualidade de pagamento", type: "select", options: ["Em dia", "Atrasos ocasionais", "Inadimplente"] },
  { key: "limiteCredito", label: "Limite de crédito (R$)", type: "number" },
  { key: "observacoes", label: "Observações", type: "textarea", span2: true },
];

export default function Clientes() {
  return (
    <RecordCrudPage
      entity="clientes"
      breadcrumb="Cadastros"
      title="Clientes"
      description="Consumidor final e clientes recorrentes atendidos."
      fields={fields}
      columns={["nome", "tipo", "contato", "telefone", "pontualidade"]}
      formatCell={(key, value) => {
        if (key === "limiteCredito") return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        return String(value ?? "—");
      }}
    />
  );
}
