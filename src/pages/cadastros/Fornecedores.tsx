import RecordCrudPage, { type FieldDef } from "../../components/RecordCrudPage";
import { CONDICOES_PAGAMENTO } from "../../utils/condicaoPagamento";

const fields: FieldDef[] = [
  { key: "nome", label: "Nome", type: "text", required: true },
  { key: "tipo", label: "Tipo", type: "select", required: true, options: ["Fabricante", "Distribuidor", "Atacadista"] },
  { key: "contato", label: "Nome do contato", type: "text" },
  { key: "cnpj", label: "CNPJ", type: "text" },
  { key: "telefone", label: "Telefone", type: "text" },
  { key: "email", label: "E-mail", type: "text" },
  { key: "formaPagamento", label: "Forma de pagamento acordada", type: "select", options: ["Boleto", "Pix", "Transferência", "Cheque", "A combinar"] },
  { key: "condicaoPagamento", label: "Condição de pagamento padrão", type: "select", options: CONDICOES_PAGAMENTO.map(c => c.label) },
  { key: "observacoes", label: "Observações", type: "textarea", span2: true },
];

export default function Fornecedores() {
  return (
    <RecordCrudPage
      entity="fornecedores"
      breadcrumb="Cadastros"
      title="Fornecedores"
      description="Fornecedores de origem dos produtos comercializados."
      fields={fields}
      columns={["nome", "tipo", "contato", "telefone", "condicaoPagamento"]}
    />
  );
}
