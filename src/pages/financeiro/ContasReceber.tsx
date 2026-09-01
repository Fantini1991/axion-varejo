import RecordCrudPage, { type FieldDef } from "../../components/RecordCrudPage";

const fields: FieldDef[] = [
  { key: "descricao", label: "Descrição", type: "text", required: true, span2: true },
  { key: "cliente", label: "Cliente", type: "text", required: true },
  { key: "valor", label: "Valor (R$)", type: "number", required: true },
  { key: "vencimento", label: "Vencimento", type: "date", required: true },
  { key: "status", label: "Status", type: "select", required: true, options: ["Pendente", "Pago", "Atrasado"] },
];

export default function ContasReceber() {
  return (
    <RecordCrudPage
      entity="contas-receber"
      breadcrumb="Financeiro"
      title="Contas a Receber"
      description="Valores a receber de clientes e revendedores."
      fields={fields}
      columns={["descricao", "cliente", "valor", "vencimento", "status"]}
      formatCell={(key, value) => {
        if (key === "valor") return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        return String(value ?? "—");
      }}
    />
  );
}
