import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Mic, Camera, Search, Plus, Baby, ShoppingCart, Trash2 } from "lucide-react";

// ===============================
// CONEXÃO COM SUPABASE
// ===============================
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function App() {

  // ===============================
  // ESTADOS
  // ===============================
  const [itens, setItens] = useState<any[]>([]);
  const [listaCategorias, setListaCategorias] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ===============================
  // TAMANHOS
  // ===============================
  const tamanhos = [
    "N/A","RN","P","M","G","GG","+3m","+6m","+9m","+12m","+18m","+24m"
  ];

  // ===============================
  // NOVO ITEM
  // ===============================
  const [novoItem, setNovoItem] = useState({
    item_nome: "",
    categoria_id:"",
    tamanho_especificacao: "N/A",
    marca: "",
    preco_pago:"",
    qtd_pacotes: 1,
    unidades_por_pacote: 1,
    local_compra:"",
    data_compra: new Date().toISOString().split("T")[0],
    foto_url: "",
    status: "Pendente"
  });

  useEffect(() => {
    fetchCategorias();
    fetchEnxoval();
  }, []);

  // ===============================
  // BUSCAR CATEGORIAS
  // ===============================
  async function fetchCategorias() {

    const { data } = await supabase
      .from("categorias")
      .select("*")
      .order("nome");

    if (data) {

      setListaCategorias(data);

      if (data.length > 0) {
        setNovoItem(prev => ({
          ...prev,
          categoria_id: data[0].id
        }));
      }

    }

  }

  // ===============================
  // BUSCAR ITENS
  // ===============================
  async function fetchEnxoval() {

    setLoading(true);

    const { data } = await supabase
      .from("enxoval")
      .select("*, categorias(nome)")
      .eq("interesse","Ativo")
      .order("item_nome");

    if (data) setItens(data);

    setLoading(false);

  }

  // ===============================
  // DETECTAR FRALDA
  // ===============================
  const isFralda = (catId:string) => {

    const cat = listaCategorias.find(c => c.id === catId);

    if(!cat) return false;

    return cat.nome?.toLowerCase().includes("fralda");

  };

  // ===============================
  // COMPRESSÃO DE IMAGEM
  // ===============================
  const comprimirImagem = (file: File): Promise<Blob> => {

    return new Promise((resolve) => {

      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (event) => {

        const img = new Image();
        img.src = event.target?.result as string;

        img.onload = () => {

          const canvas = document.createElement("canvas");

          const MAX_WIDTH = 800;

          const scaleSize = MAX_WIDTH / img.width;

          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;

          const ctx = canvas.getContext("2d");

          ctx?.drawImage(img,0,0,canvas.width,canvas.height);

          ctx?.canvas.toBlob(
            (blob)=>resolve(blob as Blob),
            "image/jpeg",
            0.7
          );

        };

      };

    });

  };

  // ===============================
  // UPLOAD FOTO
  // ===============================
  async function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>) {

    try{

      if(!e.target.files || e.target.files.length === 0) return;

      setUploading(true);

      const arquivoOriginal = e.target.files[0];

      const fotoComprimida = await comprimirImagem(arquivoOriginal);

      const fileName = `foto-${Date.now()}.jpg`;

      const { error:uploadError } =
        await supabase.storage
        .from("fotos-enxoval")
        .upload(fileName,fotoComprimida);

      if(uploadError) throw uploadError;

      const { data } =
        supabase.storage
        .from("fotos-enxoval")
        .getPublicUrl(fileName);

      setNovoItem({
        ...novoItem,
        foto_url:data.publicUrl
      });

    }
    catch(error:any){

      alert(error.message);

    }
    finally{

      setUploading(false);

    }

  }

  // ===============================
  // ADICIONAR ITEM
  // ===============================
  async function adicionarAoEnxoval(){

    if(!novoItem.item_nome.trim()) return;

    setLoading(true);

    const precoFinal =
      (Number(novoItem.preco_pago) || 0) *
      (novoItem.qtd_pacotes || 1);

    const { error } = await supabase
      .from("enxoval")
      .insert([{
        item_nome:novoItem.item_nome,
        categoria_id:novoItem.categoria_id,
        tamanho_especificacao:novoItem.tamanho_especificacao,
        marca:novoItem.marca,
        preco_pago:precoFinal,
        qtd_pacotes:novoItem.qtd_pacotes,
        unidades_por_pacote:novoItem.unidades_por_pacote,
        local_compra:novoItem.local_compra,
        data_compra:novoItem.data_compra,
        foto_url:novoItem.foto_url,
        status:novoItem.status,
        interesse:"Ativo"
      }]);

    if(!error){

      setMostrarModal(false);

      setNovoItem({
        ...novoItem,
        item_nome:"",
        foto_url:""
      });

      fetchEnxoval();

    }
    else{

      alert(error.message);

    }

    setLoading(false);

  }

  // ===============================
  // EXCLUIR ITEM
  // ===============================
  async function excluirItem(){

    if(!editando) return;

    if(!confirm(`Excluir "${editando.item_nome}"?`)) return;

    const { error } = await supabase
      .from("enxoval")
      .delete()
      .eq("id",editando.id);

    if(!error){

      setEditando(null);

      fetchEnxoval();

    }

  }

  // ===============================
  // TOTAL GASTO
  // ===============================
  const totalGasto = itens
    .reduce((acc,i)=>acc + Number(i.preco_pago || 0),0);

  // ===============================
  // FILTRO
  // ===============================
  const itensFiltrados = itens.filter(i => {

    const catMatch =
      categoriaFiltro === "Todas" ||
      i.categorias?.nome === categoriaFiltro;

    return (
      catMatch &&
      (i.item_nome ?? "")
        .toLowerCase()
        .includes(busca.toLowerCase())
    );

  });

  // ===============================
  // RENDER
  // ===============================
  return (

    <div className="flex flex-col min-h-screen bg-slate-50">

      {/* HEADER */}
      <header className="sticky top-0 bg-white border-b px-4 py-3 shadow-sm">

        <div className="flex justify-between items-center mb-3">

          <h1 className="text-lg font-black text-indigo-700">
            Jurandir Baby
          </h1>

          <div className="bg-green-100 px-3 py-1.5 rounded-lg border border-green-300">

            <span className="text-green-800 font-black">
              R$ {totalGasto.toFixed(2)}
            </span>

          </div>

        </div>

        <div className="grid grid-cols-12 gap-2">

          <div className="col-span-8 relative">

            <Search className="absolute left-3 top-3 text-slate-500" size={16} />

            <input
              className="w-full rounded-xl bg-slate-100 py-3 pl-9 pr-4"
              placeholder="Buscar..."
              value={busca}
              onChange={e=>setBusca(e.target.value)}
            />

          </div>

          <div className="col-span-4">

            <select
              value={categoriaFiltro}
              onChange={e=>setCategoriaFiltro(e.target.value)}
              className="w-full bg-indigo-700 text-white py-3 rounded-xl"
            >

              <option value="Todas">TODAS</option>

              {listaCategorias.map(cat=>(
                <option key={cat.id} value={cat.nome}>
                  {cat.nome.toUpperCase()}
                </option>
              ))}

            </select>

          </div>

        </div>

      </header>

      {/* LISTA */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3 pb-28">

        {itensFiltrados.map(item=>(
          <div
            key={item.id}
            className="bg-white rounded-2xl p-4 shadow border"
          >

            <div className="flex gap-4">

              <div className="h-16 w-16 rounded-xl bg-slate-50 flex items-center justify-center">

                {item.foto_url
                  ? <img src={item.foto_url} className="h-full w-full object-cover rounded-xl"/>
                  : <Camera size={24} className="text-slate-400"/>
                }

              </div>

              <div className="flex-1">

                <span className="text-xs font-black text-indigo-700">

                  {item.categorias?.nome}

                </span>

                <h3 className="font-black text-lg">
                  {item.item_nome}
                </h3>

                <span className="text-indigo-900 font-black">

                  R$ {Number(item.preco_pago || 0).toFixed(2)}

                </span>

              </div>

            </div>

          </div>
        ))}

      </main>

      {/* BOTÃO ADICIONAR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-10 py-4 flex justify-around">

        <ShoppingCart size={24} className="text-indigo-700"/>

        <button
          onClick={()=>setMostrarModal(true)}
          className="bg-indigo-700 p-4 rounded-full text-white shadow-xl"
        >
          <Plus size={28}/>
        </button>

        <Baby size={24} className="text-slate-400"/>

      </nav>

    </div>

  );

}
