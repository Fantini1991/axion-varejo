import { useEffect, useState } from "react";
import { listRecords, type EntityName } from "../services/persistence";

/** Carrega registros de uma entidade e devolve uma lista de rótulos prontos pra usar em campos <select>. */
export function useOptionList(entity: EntityName, labelFn: (data: Record<string, unknown>) => string): string[] {
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    listRecords(entity)
      .then(rows => setOptions(rows.map(r => labelFn(r.data))))
      .catch(() => setOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  return options;
}
