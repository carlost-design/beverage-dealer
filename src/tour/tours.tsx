import type { ReactNode } from "react";

// The walkthrough scripts, one per screen, in Tagalog. Each step lights up the
// element marked data-tour="<target>". When a list of targets is given, the
// first one visible on this screen is used (the sidebar on a laptop, the bottom
// tabs on a phone). Steps whose target is not on screen are skipped.
// Button names in <B> must match the Filipino labels in src/i18n/strings.ts.

export type TourStep = {
  target?: string | string[];
  title: string;
  body: ReactNode;
};

type Tour = { steps: TourStep[] };

function B({ children }: { children: ReactNode }) {
  return <span className="box-decoration-clone rounded-md bg-brand-soft px-1.5 py-0.5 font-semibold text-brand-strong">{children}</span>;
}

const tours = {
  home: {
    steps: [
      {
        title: "Maligayang pagdating po!",
        body: (
          <>
            Ituturo namin kung saan makikita ang bawat bagay sa app. Pindutin ang <B>Susunod</B> para magpatuloy. Puwede itong
            isara kahit kailan.
          </>
        ),
      },
      {
        target: "home-tasks",
        title: "Ang apat na pangunahing gawain",
        body: <>Nandito ang mga gagawin ninyo araw-araw. Pindutin lang ang isa para magsimula.</>,
      },
      {
        target: "home-new-order",
        title: "Bagong order",
        body: <>Kapag may umorder na suki, dito magsimula. Isang tanong lang bawat screen, kaya madali itong sundan.</>,
      },
      {
        target: "home-pay",
        title: "Tumanggap ng bayad",
        body: <>Kapag nagbayad ang suki ng utang niya.</>,
      },
      {
        target: "home-delivery",
        title: "Dumating ang delivery",
        body: <>Kapag may dumating na kaha mula sa supplier, para madagdag sa stock.</>,
      },
      {
        target: "home-close",
        title: "Isara ang araw",
        body: <>Tuwing gabi, bilangin ang mga kaha sa bodega at isara ang araw.</>,
      },
      {
        target: "home-today",
        title: "Ngayong araw",
        body: (
          <>
            Benta, natanggap na bayad, kabuuang utang, at mga late sa bayad ngayong araw. Pindutin ang isang kahon para makita ang
            detalye.
          </>
        ),
      },
      {
        target: "home-late",
        title: "Mga late sa bayad",
        body: (
          <>
            Ang mga suking lampas na sa due date. Pula ang pangalan nila. Pindutin ang <B>Singilin</B> para tumanggap ng bayad.
          </>
        ),
      },
      {
        target: "home-stock",
        title: "Stock ngayon",
        body: (
          <>
            Ilang kaha pa ang natitira sa bawat produkto. May dilaw na <B>Paubos</B> kapag kaunti na lang.
          </>
        ),
      },
      {
        target: ["nav-sidebar", "nav-bottom"],
        title: "Ang menu",
        body: (
          <>
            Dito lumipat sa ibang page: <B>Order</B>, <B>Suki</B>, <B>Stock</B> at iba pa. Ang kulay-asul ang page na bukas ngayon.
          </>
        ),
      },
      {
        target: "nav-new",
        title: "Ang asul na +",
        body: <>Pindutin ito kahit saang page para gumawa agad ng bagong order.</>,
      },
      {
        target: ["search", "search-button"],
        title: "Hanapin",
        body: <>I-type ang pangalan ng suki o ang order number para mahanap agad.</>,
      },
      {
        target: "alerts",
        title: "Mga paalala",
        body: (
          <>
            May pulang numero dito kapag may late sa bayad, paubos na stock, o araw na hindi pa naisara. Pindutin para makita.
          </>
        ),
      },
      {
        target: "text-size",
        title: "Laki ng letra",
        body: (
          <>
            Pindutin ito at piliin ang <B>Malaki</B> o <B>Mas malaki</B> kung maliit ang mga letra.
          </>
        ),
      },
      {
        target: "account",
        title: "Ang inyong menu",
        body: (
          <>
            Nandito ang <B>Settings</B>, ang nakasulat na gabay na <B>Paano gamitin</B>, at <B>Mag-sign out</B>. Sa cellphone,
            nandito rin ang <B>Ulat</B>, <B>Produkto</B>, wika at laki ng letra.
          </>
        ),
      },
      {
        target: "tour-button",
        title: "Gabayan ako",
        body: <>Pindutin ito kahit saang page. Ipapakita namin kung paano gamitin ang page na iyon, gaya nito.</>,
      },
      {
        title: "Handa na po kayo!",
        body: (
          <>
            Subukan nating gumawa ng unang order: pindutin ang <B>Bagong order</B>. Kung malito, pindutin lang ang{" "}
            <B>Gabayan ako</B>.
          </>
        ),
      },
    ],
  },

  orders: {
    steps: [
      {
        target: "orders-filters",
        title: "Pumili kung aling order",
        body: (
          <>
            <B>Kada araw</B>: mga order sa isang araw. <B>Hindi pa bayad</B>: lahat ng may utang pa. <B>Lahat</B>: lahat ng
            order. Puwede ring i-type ang pangalan o order number.
          </>
        ),
      },
      {
        target: "orders-date",
        title: "Palitan ang araw",
        body: <>Pindutin ang mga arrow para makita ang mga order kahapon o sa ibang araw.</>,
      },
      {
        target: "orders-list",
        title: "Ang mga order",
        body: (
          <>
            Pindutin ang isang order para makita ang detalye, i-print ang resibo, o markahang na-deliver na. Pula ang pangalan ng
            late sa bayad.
          </>
        ),
      },
      {
        target: "orders-new",
        title: "Bagong order",
        body: <>Pindutin ito para gumawa ng bagong order.</>,
      },
    ],
  },

  "order-detail": {
    steps: [
      {
        target: "order-items",
        title: "Mga binili",
        body: <>Ang mga produkto, ilang kaha, at ang kabuuan ng order na ito.</>,
      },
      {
        target: "order-status",
        title: "Bayad at delivery",
        body: (
          <>
            Makikita kung <B>Bayad na</B>, <B>May balanse</B> o <B>Hindi pa bayad</B>. Sa ibaba, pindutin ang <B>Papunta na</B>{" "}
            kapag umalis ang truck, at <B>Na-deliver na</B> kapag natanggap ng suki.
          </>
        ),
      },
      {
        target: "order-print",
        title: "I-print ang resibo",
        body: <>Para sa resibo o delivery receipt na pipirmahan ng suki.</>,
      },
      {
        target: "order-pay",
        title: "Tumanggap ng bayad",
        body: <>Kapag nagbayad ang suki para sa order na ito.</>,
      },
      {
        target: "order-edit",
        title: "Baguhin ang order",
        body: <>Kung may mali sa order. Puwede lang ito ngayong araw, habang bukas pa ang araw.</>,
      },
      {
        target: "order-payments",
        title: "Mga bayad",
        body: (
          <>
            Lahat ng bayad sa order na ito. Kung maling bayad ang nailagay, pindutin ang <B>Tanggalin</B>.
          </>
        ),
      },
      {
        target: "order-cancel",
        title: "I-cancel ang order",
        body: <>Kung hindi na tuloy ang order. Babalik ang mga kaha sa stock, at mananatili itong nakatala.</>,
      },
    ],
  },

  "new-order-client": {
    steps: [
      {
        target: "flow-steps",
        title: "Apat na hakbang",
        body: <>Makikita dito kung nasaang hakbang na kayo. Unang hakbang: piliin kung sino ang oorder.</>,
      },
      {
        target: "flow-client-search",
        title: "Hanapin ang suki",
        body: (
          <>
            I-type ang unang letra ng pangalan. Kung bago ang suki, pindutin ang <B>Magdagdag ng bagong suki</B>.
          </>
        ),
      },
      {
        target: "flow-client-list",
        title: "Pindutin ang pangalan",
        body: <>Pindutin ang suking oorder. Kusang pupunta ang app sa susunod na hakbang.</>,
      },
    ],
  },

  "new-order-cases": {
    steps: [
      {
        target: ["flow-product", "flow-products"],
        title: "Ilang kaha?",
        body: (
          <>
            Pindutin ang asul na <B>+</B> para magdagdag ng isang kaha, at <B>−</B> para magbawas. Puwede ring pindutin ang numero
            at i-type ito.
          </>
        ),
      },
      {
        target: ["flow-product", "flow-products"],
        title: "Bakanteng kaha",
        body: (
          <>
            Sa mga produktong may bote, lalabas ang <B>Ibinalik na bakanteng kaha</B>. Ilagay kung ilang bakanteng kaha ang dala
            ng suki.
          </>
        ),
      },
      {
        target: "flow-bar",
        title: "Kabuuan at Susunod",
        body: (
          <>
            Makikita dito ang bilang ng kaha at ang kabuuang halaga. Pindutin ang <B>Susunod</B> kapag tapos na.
          </>
        ),
      },
    ],
  },

  "new-order-details": {
    steps: [
      {
        target: "flow-fulfillment",
        title: "Paano nila makukuha?",
        body: (
          <>
            <B>Ide-deliver natin</B> o <B>Kukunin nila</B>. Kapag ide-deliver, tingnan kung tama ang address.
          </>
        ),
      },
      {
        target: "flow-payment",
        title: "Paano sila magbabayad?",
        body: (
          <>
            <B>Utang</B>, <B>Bayad na lahat ngayon</B>, o <B>May bayad na, kulang pa</B>. Kung may bayad, piliin kung Cash, GCash,
            Maya, bangko o tseke.
          </>
        ),
      },
      {
        target: "flow-discount",
        title: "Discount",
        body: (
          <>
            Kusang nakalagay ang karaniwang discount ng suki. Pindutin ang <B>Palitan ang discount</B> kung iba ngayon.
          </>
        ),
      },
      {
        target: "flow-note",
        title: "Paalala sa resibo",
        body: <>Puwedeng magsulat ng paalala na lalabas sa resibo. Hindi ito kailangan.</>,
      },
      {
        target: "flow-next",
        title: "Susunod",
        body: <>Pindutin para tingnan ang buong order bago i-save.</>,
      },
    ],
  },

  "new-order-review": {
    steps: [
      {
        target: "flow-review",
        title: "Tingnan muna",
        body: (
          <>
            Basahin ang mga binili, discount, kabuuan at bayad. Kung may mali, pindutin ang <B>Bumalik</B> sa ibaba.
          </>
        ),
      },
      {
        target: "flow-save",
        title: "I-save ang order",
        body: (
          <>
            Kapag tama lahat, pindutin ang berdeng <B>I-save ang order</B>. Pagkatapos, puwedeng i-print ang resibo.
          </>
        ),
      },
    ],
  },

  "pay-client": {
    steps: [
      {
        target: "flow-steps",
        title: "Dalawang hakbang",
        body: <>Una, piliin ang suking magbabayad. Pangalawa, ilagay kung magkano.</>,
      },
      {
        target: "pay-search",
        title: "Hanapin ang suki",
        body: <>I-type ang unang letra ng pangalan kung mahaba ang listahan.</>,
      },
      {
        target: "pay-list",
        title: "Ang mga may utang",
        body: <>Ang mga may utang lang ang nakalista, kasama kung magkano. Pindutin ang suking magbabayad.</>,
      },
    ],
  },

  "pay-amount": {
    steps: [
      {
        target: "pay-amount",
        title: "Magkano ang natanggap?",
        body: (
          <>
            I-type ang halaga, o pindutin ang <B>Bayaran lahat</B>. Piliin kung paano nagbayad. Makikita sa{" "}
            <B>Mababayaran nito</B> kung aling order ang mababayaran; pinakaluma ang nauuna.
          </>
        ),
      },
      {
        target: "pay-save",
        title: "I-save ang bayad",
        body: (
          <>
            Pindutin ang berdeng <B>I-save ang bayad</B>. Makikita pagkatapos kung may natitira pang utang.
          </>
        ),
      },
    ],
  },

  stock: {
    steps: [
      {
        target: "stock-totals",
        title: "Ang stock ngayong araw",
        body: <>Simula ng araw, dumating, nabenta, at ang stock ngayon. Lahat ay bilang ng kaha.</>,
      },
      {
        target: "stock-table",
        title: "Bawat produkto",
        body: (
          <>
            Ilang kaha ng bawat produkto ang natitira. May dilaw na <B>Paubos</B> kapag kaunti na lang.
          </>
        ),
      },
      {
        target: "stock-delivery",
        title: "Dumating ang delivery",
        body: <>Kapag may dumating na kaha mula sa supplier.</>,
      },
      {
        target: "stock-damaged",
        title: "Sira o maling bilang",
        body: <>Para sa basag na bote, o kung mali ang bilang sa bodega. Isusulat ninyo ang dahilan.</>,
      },
      {
        target: "stock-close",
        title: "Bilangin at isara ang araw",
        body: <>Tuwing gabi, pagkatapos ng huling order.</>,
      },
      {
        target: "stock-reopen",
        title: "Buksan ulit ang araw",
        body: <>Kung may order pa pagkatapos isara ang araw. Isara ulit ito pagkatapos.</>,
      },
      {
        target: "stock-date",
        title: "Ibang araw",
        body: <>Pindutin ang mga arrow para makita ang stock sa mga nakaraang araw.</>,
      },
      {
        target: "stock-empties",
        title: "Bakanteng kaha sa bodega",
        body: (
          <>
            Ilang bakanteng kaha ang ibabalik sa supplier. Pindutin ang <B>Itama</B> kung mali ang bilang.
          </>
        ),
      },
    ],
  },

  delivery: {
    steps: [
      {
        target: "delivery-supplier",
        title: "Saan galing?",
        body: <>I-type ang supplier at ang DR o invoice number. Hindi ito kailangan, pero nakakatulong.</>,
      },
      {
        target: "delivery-cases",
        title: "Kahang dumating",
        body: (
          <>
            Pindutin ang <B>+</B> sa bawat produktong dumating. Pindutin ang <B>Palitan ang puhunan</B> kung nagbago ang presyo ng
            supplier.
          </>
        ),
      },
      {
        target: "delivery-empties",
        title: "Ibinalik na bakanteng kaha",
        body: <>Ilang bakanteng kaha ang ibinigay ninyo sa supplier.</>,
      },
      {
        target: "delivery-save",
        title: "Idagdag sa stock",
        body: (
          <>
            Pindutin ang <B>Idagdag sa stock</B> kapag tapos na. Madadagdag agad ang mga kaha.
          </>
        ),
      },
    ],
  },

  "close-day": {
    steps: [
      {
        target: "close-list",
        title: "Bilangin ang bodega",
        body: (
          <>
            Nakalagay na ang bilang na inaasahan ng app. Bilangin ang mga punong kaha sa bodega at palitan ang numero kung iba.
          </>
        ),
      },
      {
        target: "close-list",
        title: "Tama, kulang o sobra",
        body: (
          <>
            Makikita agad sa bawat produkto kung <B>Tama</B>, <B>Kulang</B> o <B>Sobra</B> ang bilang.
          </>
        ),
      },
      {
        target: "close-button",
        title: "Isara ang araw",
        body: <>Pindutin kapag tapos nang bilangin. Ang bilang ninyo ang magiging simula ng stock bukas.</>,
      },
    ],
  },

  clients: {
    steps: [
      {
        target: "clients-filters",
        title: "Pumili kung sino",
        body: (
          <>
            <B>Lahat</B>, <B>May utang</B>, <B>Late</B>, <B>May utang na kaha</B>, o <B>Naka-archive</B>. Puwede ring i-type ang
            pangalan.
          </>
        ),
      },
      {
        target: "clients-list",
        title: "Ang mga suki",
        body: <>Pula ang pangalan ng late sa bayad. Pindutin ang isang suki para makita ang utang at mga order niya.</>,
      },
      {
        target: "clients-add",
        title: "Magdagdag ng suki",
        body: <>Ilagay ang pangalan, tindahan, terms ng bayad, credit limit at karaniwang discount.</>,
      },
    ],
  },

  "client-detail": {
    steps: [
      {
        target: "client-stats",
        title: "Utang ng suki",
        body: <>Kabuuang utang, ang lampas na sa due, at ang bakanteng kahang dapat pang ibalik.</>,
      },
      {
        target: "client-actions",
        title: "Mga gawain",
        body: (
          <>
            <B>Bagong order</B> para sa suking ito, <B>Tumanggap ng bayad</B>, o <B>I-print ang listahan ng utang</B> para may
            maibigay na papel sa suki.
          </>
        ),
      },
      {
        target: "client-unpaid",
        title: "Mga hindi pa bayad",
        body: <>Pinakaluma ang nauuna. Pindutin ang isa para makita ang order.</>,
      },
      {
        target: "client-details",
        title: "Detalye",
        body: (
          <>
            Telepono, address, terms, discount at credit limit. Pindutin ang <B>Baguhin</B> para palitan.
          </>
        ),
      },
      {
        target: "client-empties",
        title: "Bakanteng kaha",
        body: (
          <>
            Ilang kaha ang nasa suki pa. Pindutin ang <B>Ibinalik na bakanteng kaha</B> kapag nagbalik siya nang walang order.
          </>
        ),
      },
      {
        target: "client-archive",
        title: "I-archive ang suki",
        body: <>Kung hindi na bumibili ang suki. Hindi siya mabubura, at puwede siyang ibalik kahit kailan.</>,
      },
    ],
  },

  products: {
    steps: [
      {
        target: "products-list",
        title: "Ang mga produkto",
        body: (
          <>
            Presyo, puhunan at tubo kada kaha, at ang stock ngayon. Pindutin ang <B>Baguhin</B> para palitan ang presyo. Ang bagong
            presyo ay para lang sa mga bagong order.
          </>
        ),
      },
      {
        target: "products-add",
        title: "Magdagdag ng produkto",
        body: <>Ilagay ang pangalan kasama ang laki (hal. Red Horse 1L), ang presyo at ang puhunan kada kaha.</>,
      },
    ],
  },

  reports: {
    steps: [
      {
        target: "reports-kpis",
        title: "Nakaraang 30 araw",
        body: (
          <>
            Benta, natanggap na bayad, tubo at kahang nabenta. Ang maliit na berde o pulang numero ay ang pagbabago kumpara sa
            naunang 30 araw.
          </>
        ),
      },
      {
        target: "reports-chart",
        title: "Benta at bayad kada araw",
        body: (
          <>
            Asul ang benta, abo ang natanggap na bayad. Pindutin ang <B>Ipakita bilang table</B> kung mas madaling basahin.
          </>
        ),
      },
      {
        target: "reports-best",
        title: "Pinakamabenta",
        body: <>Ang mga produktong pinakamaraming kahang nabenta.</>,
      },
      {
        target: "reports-clients",
        title: "Pinakamalalaking suki",
        body: <>Ang mga suking pinakamalaki ang binili sa nakaraang 30 araw.</>,
      },
    ],
  },

  settings: {
    steps: [
      {
        target: "settings-language",
        title: "Wika",
        body: <>Piliin ang English o Filipino para sa mga salita sa app at sa resibo.</>,
      },
      {
        target: "settings-textsize",
        title: "Laki ng letra",
        body: <>Palakihin ang mga letra sa device na ito.</>,
      },
      {
        target: "settings-business",
        title: "Tindahan at resibo",
        body: (
          <>
            Pangalan, address at telepono na lalabas sa resibo, ang laki ng papel (58 o 80 mm), at ilang kopya. Pindutin ang{" "}
            <B>Subukang mag-print</B> para makita ang labas.
          </>
        ),
      },
      {
        target: "settings-activity",
        title: "Talaan ng mga ginawa",
        body: <>Lahat ng kinansela, binago at itinama ay nakatala dito. Walang nawawala.</>,
      },
    ],
  },

  help: {
    steps: [
      {
        target: "help-tours",
        title: "Mga gabay sa screen",
        body: <>Pumili ng isa. Ipapakita namin kung paano, sa mismong screen, gaya nito.</>,
      },
      {
        target: "help-topics",
        title: "Nakasulat na gabay",
        body: <>Kung mas gusto ninyong magbasa, pindutin ang isang paksa.</>,
      },
    ],
  },
} satisfies Record<string, Tour>;

export type TourKey = keyof typeof tours;
export const TOURS: Record<TourKey, Tour> = tours;

// The tours the Help page offers, with the screen each one starts on.
export const TOUR_MENU: { key: TourKey; path: string; label: string }[] = [
  { key: "home", path: "/", label: "Kilalanin ang app" },
  { key: "new-order-client", path: "/orders/new", label: "Bagong order" },
  { key: "pay-client", path: "/payments/new", label: "Tumanggap ng bayad" },
  { key: "orders", path: "/orders", label: "Mga order" },
  { key: "delivery", path: "/inventory/delivery", label: "Dumating ang delivery" },
  { key: "stock", path: "/inventory", label: "Stock" },
  { key: "close-day", path: "/inventory/close", label: "Isara ang araw" },
  { key: "clients", path: "/clients", label: "Mga suki" },
  { key: "products", path: "/products", label: "Mga produkto" },
  { key: "reports", path: "/reports", label: "Ulat" },
  { key: "settings", path: "/settings", label: "Settings" },
];
