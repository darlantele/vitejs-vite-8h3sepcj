import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Camera, Search, Plus } from "lucide-react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

type Item = {
  id?: number;
  item_nome: string;
  categoria_id: number | null;
  tamanho_especificacao: string;
  marca: string;
  preco_pago: number | null;
  qtd_pacotes: number;
  unidades_por_pacote: number;
  foto_url?: string;
};

export default function App() {
  const [itens, setItens] = useState<Item[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [busca, setBusca] = useState("");

  const tamanhos = [
    "N/A",
    "RN",
    "P",
    "M",
    "G",
    "GG",
    "+3m",
    "+6m",
    "+9m",
    "+12m",
    "+18m",
    "+24m",
  ];

  const [novoItem, setNovoItem] = useState<Item>({
    item_nome: "",
    categoria_id: null,
    tamanho_especificacao: "N/A",
    marca: "",
    preco_pago: null,
    qtd_pacotes: 1,
    unidades_por_pacote: 1,
  });

  useEffect(() => {
    carregarCategorias();
    carregarItens();
  }, []);

  async function carregarCategorias() {
    const { data } = await supabase.from("categorias").select("*");
    if (data) setCategorias(data);
  }

  async function carregarItens() {
    const { data } = await supabase.from("enxoval").select("*");
    if (data) setItens(data);
  }

  async function adicionarItem() {
    if (!novoItem.item_nome) return;

    const { error } = await supabase.from("enxoval").insert([novoItem]);

    if (!error) {
      carregarItens();

      setNovoItem({
        item_nome: "",
        categoria_id: null,
        tamanho_especificacao: "N/A",
        marca: "",
        preco_pago: null,
        qtd_pacotes: 1,
        unidades_por_pacote: 1,
      });
    }
  }

  async function uploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const fileName = `${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from("fotos-enxoval")
      .upload(fileName, file);

    if (error) {
      alert("Erro ao enviar foto");
      return;
    }

    const { data } = supabase.storage
      .from("fotos-enxoval")
      .getPublicUrl(fileName);

    setNovoItem({
      ...novoItem,
      foto_url: data.publicUrl,
    });
  }

  const itensFiltrados = itens.filter((i) =>
    i.item_nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4">

      <h1 className="text-2xl font-bold text-indigo-700">
        Controle do Enxoval
      </h1>

      <div className="relative">
        <Search className="absolute left-2 top-2 text-gray-400" size={18} />
        <input
          placeholder="Buscar item..."
          className="w-full border rounded-xl pl-8 p-2"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="bg-white p-4 rounded-xl border space-y-3">

        <input
          placeholder="Nome do item"
          className="border p-2 rounded-xl w-full"
          value={novoItem.item_nome}
          onChange={(e) =>
            setNovoItem({ ...novoItem, item_nome: e.target.value })
          }
        />

        <select
          className="border p-2 rounded-xl w-full"
          value={novoItem.tamanho_especificacao}
          onChange={(e) =>
            setNovoItem({
              ...novoItem,
              tamanho_especificacao: e.target.value,
            })
          }
        >
          {tamanhos.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

        <input
          placeholder="Marca"
          className="border p-2 rounded-xl w-full"
          value={novoItem.marca}
          onChange={(e) =>
            setNovoItem({ ...novoItem, marca: e.target.value })
          }
        />

        <input
          type="number"
          placeholder="Preço"
          className="border p-2 rounded-xl w-full"
          value={novoItem.preco_pago ?? ""}
          onChange={(e) =>
            setNovoItem({
              ...novoItem,
              preco_pago: Number(e.target.value),
            })
          }
        />

        <input type="file" accept="image/*" onChange={uploadFoto} />

        <button
          onClick={adicionarItem}
          className="bg-indigo-600 text-white p-3 rounded-xl w-full flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          Adicionar item
        </button>

      </div>

      <div className="space-y-2">

        {itensFiltrados.map((item) => (
          <div
            key={item.id}
            className="border rounded-xl p-3 flex gap-3 items-center"
          >
            <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
              {item.foto_url ? (
                <img src={item.foto_url} className="object-cover h-full w-full" />
              ) : (
                <Camera size={20} className="text-gray-400" />
              )}
            </div>

            <div>
              <div className="font-semibold">{item.item_nome}</div>
              <div className="text-sm text-gray-500">
                {item.tamanho_especificacao}
              </div>
              <div className="text-indigo-700 font-bold">
                R$ {item.preco_pago ?? 0}
              </div>
            </div>
          </div>
        ))}

      </div>

    </div>
  );
}
