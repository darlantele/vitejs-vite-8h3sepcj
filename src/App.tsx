import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Camera, Search, Plus, Baby, ShoppingCart } from "lucide-react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function App() {

  const [itens, setItens] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");

  const [novoItem, setNovoItem] = useState({
    item_nome: "",
    categoria_id: "",
    tamanho_especificacao: "N/A",
    marca: "",
    preco_pago: "",
    qtd_pacotes: 1,
    unidades_por_pacote: 1,
    local_compra: "",
    data_compra: new Date().toISOString().split("T")[0],
    foto_url: "",
    status: "Pendente"
  });

  const tamanhos = [
    "N/A","RN","P","M","G","GG","+3m","+6m","+9m","+12m","+18m","+24m"
  ];

  useEffect(()=>{
    fetchCategorias();
    fetchItens();
  },[]);

  async function fetchCategorias(){

    const { data } = await supabase
      .from("categorias")
      .select("*")
      .order("nome");

    if(data){
      setCategorias(data);

      if(data.length > 0){
        setNovoItem(prev=>({
          ...prev,
          categoria_id:data[0].id
        }));
      }
    }

  }

  async function fetchItens(){

    const { data } = await supabase
      .from("enxoval")
      .select("*, categorias(nome)")
      .eq("interesse","Ativo")
      .order("item_nome");

    if(data){
      setItens(data);
    }

  }

  const comprimirImagem = (file: File): Promise<Blob> => {

    return new Promise((resolve)=>{

      const reader = new FileReader();

      reader.readAsDataURL(file);

      reader.onload = e=>{

        const img = new Image();

        img.src = e.target?.result as string;

        img.onload = ()=>{

          const canvas = document.createElement("canvas");

          const MAX_WIDTH = 800;

          const scale = MAX_WIDTH / img.width;

          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;

          const ctx = canvas.getContext("2d");

          ctx?.drawImage(img,0,0,canvas.width,canvas.height);

          canvas.toBlob(
            blob=>resolve(blob as Blob),
            "image/jpeg",
            0.7
          );

        };

      };

    });

  };

  async function uploadFoto(e: React.ChangeEvent<HTMLInputElement>){

    if(!e.target.files || e.target.files.length === 0) return;

    const fotoComprimida = await comprimirImagem(e.target.files[0]);

    const fileName = `foto-${Date.now()}.jpg`;

    const { error } = await supabase
      .storage
      .from("fotos-enxoval")
      .upload(fileName,fotoComprimida);

    if(error){
      alert(error.message);
      return;
    }

    const { data } =
      supabase.storage
      .from("fotos-enxoval")
      .getPublicUrl(fileName);

    setNovoItem({
      ...novoItem,
      foto_url:data.publicUrl
    });

  }

  async function adicionarItem(){

    if(!novoItem.item_nome.trim()) return;

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
        status:"Comprado",
        interesse:"Ativo"
      }]);

    if(!error){

      setNovoItem({
        ...novoItem,
        item_nome:"",
        foto_url:""
      });

      fetchItens();

    }

  }

  const totalGasto = itens.reduce(
    (acc,i)=>acc + Number(i.preco_pago || 0),
    0
  );

  const itensFiltrados = itens.filter(i=>{

    const matchCategoria =
      categoriaFiltro === "Todas" ||
      i.categorias?.nome === categoriaFiltro;

    const matchBusca =
      (i.item_nome ?? "")
      .toLowerCase()
      .includes(busca.toLowerCase());

    return matchCategoria && matchBusca;

  });

  return(

    <div className="flex flex-col min-h-screen bg-slate-50">

      <header className="sticky top-0 bg-white border-b px-4 py-3">

        <div className="flex justify-between mb-3">

          <h1 className="font-black text-indigo-700">
            Jurandir Baby
          </h1>

          <div className="bg-green-100 px-3 py-1 rounded-lg">
            R$ {totalGasto.toFixed(2)}
          </div>

        </div>

        <div className="grid grid-cols-12 gap-2">

          <div className="col-span-8 relative">

            <Search size={16} className="absolute left-3 top-3 text-slate-500"/>

            <input
              className="w-full rounded-xl bg-slate-100 py-3 pl-8"
              placeholder="Buscar..."
              value={busca}
              onChange={e=>setBusca(e.target.value)}
            />

          </div>

          <div className="col-span-4">

            <select
              value={categoriaFiltro}
              onChange={e=>setCategoriaFiltro(e.target.value)}
              className="w-full bg-indigo-700 text-white rounded-xl py-3"
            >

              <option value="Todas">TODAS</option>

              {categorias.map(c=>(
                <option key={c.id} value={c.nome}>
                  {c.nome.toUpperCase()}
                </option>
              ))}

            </select>

          </div>

        </div>

      </header>

      <main className="flex-1 overflow-y-auto p-3 space-y-3 pb-32">

        {itensFiltrados.map(item=>(

          <div
            key={item.id}
            className="bg-white rounded-2xl p-4 shadow border"
          >

            <div className="flex gap-4">

              <div className="h-16 w-16 bg-slate-100 rounded-xl flex items-center justify-center">

                {item.foto_url
                  ? <img src={item.foto_url} className="h-full w-full object-cover rounded-xl"/>
                  : <Camera size={24} className="text-slate-400"/>
                }

              </div>

              <div>

                <div className="text-xs font-bold text-indigo-700">

                  {item.categorias?.nome}

                </div>

                <div className="font-bold text-lg">

                  {item.item_nome}

                </div>

                <div className="text-indigo-900 font-bold">

                  R$ {Number(item.preco_pago || 0).toFixed(2)}

                </div>

              </div>

            </div>

          </div>

        ))}

      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-4">

        <ShoppingCart className="text-indigo-700"/>

        <button
          onClick={adicionarItem}
          className="bg-indigo-700 p-4 rounded-full text-white"
        >
          <Plus/>
        </button>

        <Baby className="text-slate-400"/>

      </nav>

    </div>

  );

}
