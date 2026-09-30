import {
  AlertTriangle,
  ArrowUp,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  LayoutGrid,
  Lightbulb,
  Package,
  PackageCheck,
  Printer,
  Recycle,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  Type,
  Undo2,
  Users,
  Wallet,
  MessageCircleQuestion,
  CircleHelp,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Card, Chip, IconTile, LinkButton, PageHeader, type Tone } from "../components/ui";
import { useTour, useTourPage } from "../tour/TourProvider";
import { TOUR_MENU } from "../tour/tours";

// The user guide. It is written in Tagalog only, on purpose: the dealers asked
// for a Tagalog guide, so it does not follow the English / Filipino switch.
// Button names in <B> must match the Filipino labels in src/i18n/strings.ts.

type Section = {
  id: string;
  title: string;
  short: string;
  icon: LucideIcon;
  tone: Tone;
  intro?: ReactNode;
  steps?: ReactNode[];
  tips?: ReactNode[];
  extra?: ReactNode;
  action?: { to: string; label: string };
};

// A button or label exactly as it appears on screen.
function B({ children }: { children: ReactNode }) {
  return (
    <span className="box-decoration-clone rounded-md bg-brand-soft px-1.5 py-0.5 font-semibold text-brand-strong">{children}</span>
  );
}

const SECTIONS: Section[] = [
  {
    id: "simula",
    title: "Unang gamit: i-set up ang tindahan",
    short: "Unang gamit",
    icon: Store,
    tone: "blue",
    intro: (
      <>
        Gawin ito nang isang beses lang. Sa Home, may listahang <B>I-set up natin ang tindahan</B> na may tatlong hakbang.
        Mawawala ito kapag tapos na lahat.
      </>
    ),
    steps: [
      <>
        Pindutin ang <B>Ilagay ang pangalan ng tindahan para sa resibo</B>. I-type ang pangalan, address at telepono ng tindahan,
        pagkatapos pindutin ang <B>I-save ang settings</B>.
      </>,
      <>
        Pindutin ang <B>Ilagay ang mga produktong binebenta</B>. Ilagay ang bawat produkto kasama ang laki, gaya ng
        "Coke 8oz" o "Red Horse 1L", at ang presyo kada kaha. (Tingnan ang <B>Mga produkto</B> sa ibaba.)
      </>,
      <>
        Pindutin ang <B>Ilagay ang mga suki</B>. Ilagay ang bawat tindahang binebentahan ninyo. (Tingnan ang <B>Mga suki</B> sa
        ibaba.)
      </>,
    ],
    tips: [
      <>Isang account lang ang puwede sa app, ang sa may-ari. Tandaan po ang email at password na ginamit.</>,
    ],
  },
  {
    id: "menu",
    title: "Paano gumalaw sa app",
    short: "Ang menu",
    icon: LayoutGrid,
    tone: "gray",
    steps: [
      <>
        <strong>Sa laptop:</strong> nasa kaliwa ang menu: <B>Home</B>, <B>Order</B>, <B>Suki</B>, <B>Stock</B>, <B>Ulat</B>,{" "}
        <B>Produkto</B> at <B>Settings</B>. Ang kulay-asul ang page na bukas ngayon.
      </>,
      <>
        <strong>Sa iPad o cellphone:</strong> nasa ibaba ng screen ang menu. Ang malaking asul na bilog na may <B>+</B> sa gitna
        (<B>Bago</B>) ay para sa bagong order. Ang <B>Ulat</B>, <B>Produkto</B> at <B>Settings</B> ay nasa bilog na may inyong
        initials, sa kanang itaas.
      </>,
      <>
        <strong>Paghahanap:</strong> i-type ang pangalan ng suki o ang order number sa <B>Hanapin</B> sa itaas. Sa cellphone,
        pindutin muna ang magnifying glass.
      </>,
      <>
        <strong>Kampana (<Bell className="inline size-5 align-text-bottom" aria-hidden />):</strong> may pulang numero kapag may
        late sa bayad, may paubos na stock, o may araw na hindi pa naisara. Pindutin para makita ang listahan.
      </>,
      <>
        <strong>Laki ng letra:</strong> sa laptop, pindutin ang bilog na may letrang{" "}
        <Type className="inline size-5 align-text-bottom" aria-hidden /> sa itaas at piliin ang <B>Karaniwan</B>, <B>Malaki</B>{" "}
        o <B>Mas malaki</B>. Sa cellphone, nasa bilog na may inyong initials ito.
      </>,
      <>
        <strong>Wika:</strong> pindutin ang <B>English</B> o <B>Filipino</B> sa itaas (sa cellphone, nasa bilog na may inyong
        initials) para palitan ang mga salita sa app at sa resibo.
      </>,
    ],
  },
  {
    id: "bagong-order",
    title: "Gumawa ng bagong order",
    short: "Bagong order",
    icon: ShoppingCart,
    tone: "blue",
    intro: (
      <>
        Sa Home, pindutin ang malaking asul na <B>Bagong order</B>. May apat na hakbang. Sa bawat hakbang, pindutin ang{" "}
        <B>Susunod</B> sa ibaba para magpatuloy, o <B>Bumalik</B> para ayusin ang nauna.
      </>
    ),
    steps: [
      <>
        <strong>Sino ang oorder?</strong> I-type ang unang letra ng pangalan ng suki at pindutin ang tamang pangalan. Kung bago
        ang suki, pindutin ang <B>Magdagdag ng bagong suki</B>.
      </>,
      <>
        <strong>Ilang kaha?</strong> Pindutin ang asul na <B>+</B> sa tabi ng bawat produkto para magdagdag ng kaha, at ang{" "}
        <B>−</B> para magbawas. Puwede ring pindutin ang numero at i-type ito. Ilagay din kung ilang{" "}
        <B>Ibinalik na bakanteng kaha</B> ang dala ng suki.
      </>,
      <>
        <strong>Delivery at bayad.</strong> Piliin ang <B>Ide-deliver natin</B> o <B>Kukunin nila</B>. Pagkatapos, piliin kung
        paano sila magbabayad: <B>Utang (bayad sa susunod)</B>, <B>Bayad na lahat ngayon</B>, o{" "}
        <B>May bayad na, kulang pa</B>. Kung may bayad, piliin ang Cash, GCash, Maya, bangko o tseke.
      </>,
      <>
        <strong>Tingnan at i-save.</strong> Basahin ang mga binili at ang kabuuan. Kung tama lahat, pindutin ang berdeng{" "}
        <B>I-save ang order</B>.
      </>,
      <>
        Lalabas ang <B>Na-save na po ang order!</B> Dito puwedeng pindutin ang <B>I-print ang resibo</B>,{" "}
        <B>Isa pang bagong order</B>, o <B>Bumalik sa Home</B>.
      </>,
    ],
    tips: [
      <>Kusang nababawas sa stock ang mga kahang na-order. Hindi na kailangang bawasan nang mano-mano.</>,
      <>
        May <B>Discount kada kaha</B> sa ilalim ng bawat produkto sa hakbang 2. Kusang nakalagay ang karaniwang discount ng
        suki. Kapag binago mo ito, itatanong sa hakbang 3 kung <B>Gamitin din sa susunod</B> o <B>Sa order na ito lang</B>.
      </>,
      <>
        Magbababala ang app kapag late sa bayad ang suki, o kapag lalampas siya sa credit limit. Puwede pa ring ituloy ang order.
      </>,
    ],
    action: { to: "/orders/new", label: "Gumawa ng bagong order" },
  },
  {
    id: "bayad",
    title: "Tumanggap ng bayad sa utang",
    short: "Tumanggap ng bayad",
    icon: Wallet,
    tone: "green",
    intro: (
      <>
        Gamitin ito kapag nagbayad ang suki ng utang niya. Sa Home, pindutin ang <B>Tumanggap ng bayad</B>.
      </>
    ),
    steps: [
      <>
        <strong>Sino ang magbabayad?</strong> Ang mga may utang lang ang nakalista. Pindutin ang pangalan ng suki.
      </>,
      <>
        <strong>Magkano ang ibabayad?</strong> I-type ang halagang natanggap, o pindutin ang <B>Bayaran lahat</B> kung buo ang
        bayad. Piliin kung Cash, GCash, Maya, bangko o tseke.
      </>,
      <>
        Makikita sa <B>Mababayaran nito</B> kung aling mga order ang mababayaran. Ang pinakalumang utang ang unang nababayaran.
      </>,
      <>
        Pindutin ang berdeng <B>I-save ang bayad</B>. Makikita ang <B>Natitirang utang</B>, kung mayroon pa.
      </>,
    ],
    tips: [
      <>
        Puwede ring tumanggap ng bayad mula sa page ng isang order: buksan ang order at pindutin ang <B>Tumanggap ng bayad</B>.
      </>,
      <>
        Para sa GCash, Maya, bangko o tseke, i-type ang reference number para madaling hanapin kung kailangan.
      </>,
    ],
    action: { to: "/payments/new", label: "Tumanggap ng bayad" },
  },
  {
    id: "deliver",
    title: "Pag-deliver at pagkuha ng order",
    short: "Delivery ng order",
    icon: Truck,
    tone: "blue",
    steps: [
      <>
        Pindutin ang <B>Order</B> sa menu. Sa <B>Kada araw</B>, makikita ang lahat ng order ngayong araw. Pindutin ang order na
        ide-deliver.
      </>,
      <>
        Kapag umalis na ang truck, pindutin ang <B>Papunta na</B>.
      </>,
      <>
        Pagdating sa suki, pindutin ang <B>Na-deliver na</B>. Kung kinuha ng suki sa bodega, pindutin ang <B>Nakuha na</B>.
      </>,
      <>
        Pindutin ang <B>I-print ang resibo</B> para sa delivery receipt. May linya ito sa ibaba para sa pangalan at pirma ng
        tumanggap.
      </>,
    ],
    tips: [<>Ang berdeng numero sa tabi ng <B>Order</B> sa menu ay ang bilang ng order na ide-deliver pa.</>],
    action: { to: "/orders", label: "Buksan ang mga order" },
  },
  {
    id: "dumating",
    title: "Dumating ang delivery mula sa supplier",
    short: "Dumating ang delivery",
    icon: PackageCheck,
    tone: "orange",
    intro: <>Gawin ito tuwing may dumating na kaha mula sa supplier, para madagdag sa stock.</>,
    steps: [
      <>
        Sa Home, pindutin ang <B>Dumating ang delivery</B>.
      </>,
      <>
        I-type kung saang supplier galing (hal. San Miguel Brewery) at ang DR o invoice number. Hindi ito kailangan pero
        nakakatulong.
      </>,
      <>
        Sa bawat produkto, ilagay ang bilang ng <B>Kahang dumating</B> gamit ang <B>+</B> at <B>−</B>. Ilagay din kung ilang{" "}
        <B>Ibinalik na bakanteng kaha</B> ang ibinigay ninyo sa supplier.
      </>,
      <>
        Pindutin ang <B>Idagdag sa stock</B>.
      </>,
    ],
    tips: [
      <>
        Kung nagbago ang puhunan kada kaha, pindutin ang <B>Palitan ang puhunan</B> para tama ang tubo sa Ulat.
      </>,
    ],
    action: { to: "/inventory/delivery", label: "Dumating ang delivery" },
  },
  {
    id: "isara",
    title: "Isara ang araw (bilangin ang stock)",
    short: "Isara ang araw",
    icon: ClipboardCheck,
    tone: "violet",
    intro: (
      <>
        Gawin ito tuwing gabi, pagkatapos ng huling order. Bibilangin ninyo ang mga punong kaha sa bodega. Ang bilang ninyo ang
        magiging simula ng stock bukas.
      </>
    ),
    steps: [
      <>
        Sa Home, pindutin ang <B>Isara ang araw</B>.
      </>,
      <>
        Nakalagay na ang bilang na inaasahan ng system. Bilangin ang mga punong kaha sa bodega. Kung iba ang bilang ninyo,
        palitan ang numero.
      </>,
      <>
        Makikita kung <B>Tama</B>, <B>Kulang</B> o <B>Sobra</B> ang bawat produkto.
      </>,
      <>
        Pindutin ang <B>Isara ang</B> (kasunod ang petsa), tapos <B>Oo, isara ang araw</B>.
      </>,
    ],
    tips: [
      <>
        Kung may order pa pagkatapos isara, pumunta sa <B>Stock</B> at pindutin ang <B>Buksan ulit ang araw</B>. Isara ulit ito
        pagkatapos.
      </>,
      <>
        Kung nakalimutang isara kahapon, may paalala sa Home: <B>Hindi pa naisara</B>. Pindutin ang <B>Bilangin at isara</B>.
      </>,
    ],
    action: { to: "/inventory/close", label: "Isara ang araw" },
  },
  {
    id: "suki",
    title: "Mga suki",
    short: "Mga suki",
    icon: Users,
    tone: "blue",
    steps: [
      <>
        Pindutin ang <B>Suki</B> sa menu, tapos <B>Magdagdag ng suki</B>.
      </>,
      <>
        Ilagay ang pangalan, pangalan ng tindahan, telepono at address para sa delivery.
      </>,
      <>
        Piliin ang <B>Terms ng bayad</B>: <B>Bayad agad (COD)</B> o ilang araw bago dapat magbayad (hal. 7 araw). Dito
        binibilang kung kailan magiging late ang utang.
      </>,
      <>
        Kung gusto, ilagay ang <B>Credit limit</B> (pinakamalaking utang na puwede). Ang discount ng suki ay inilalagay sa
        unang order niya.
      </>,
      <>
        Pindutin ang <B>Idagdag ang suki</B>.
      </>,
    ],
    tips: [
      <>
        Pindutin ang pangalan ng suki para makita ang utang niya, mga huling order at bayad, at ang bakanteng kahang nasa kaniya
        pa.
      </>,
      <>
        Sa page ng suki, pindutin ang <B>I-print ang listahan ng utang</B> para may maibigay na papel sa suki.
      </>,
      <>
        Kung hindi na bumibili ang suki, pindutin ang <B>I-archive ang suki</B>. Hindi siya mabubura; puwede siyang ibalik
        kahit kailan.
      </>,
    ],
    action: { to: "/clients", label: "Buksan ang mga suki" },
  },
  {
    id: "kaha",
    title: "Bakanteng kaha (empties)",
    short: "Bakanteng kaha",
    icon: Recycle,
    tone: "green",
    intro: (
      <>
        Binibilang ng app ang mga bakanteng kaha para sa mga produktong may ibinabalik na bote. Kapag kulang ang ibinalik ng suki,
        lalabas na may utang siyang kaha.
      </>
    ),
    steps: [
      <>
        Sa bawat bagong order, ilagay sa <B>Ibinalik na bakanteng kaha</B> kung ilan ang dala ng suki.
      </>,
      <>
        Kung nagbalik ang suki ng kaha nang walang order, buksan ang page ng suki at pindutin ang{" "}
        <B>Ibinalik na bakanteng kaha</B>.
      </>,
      <>
        Para itama ang lumang utang na kaha, o kung nagbayad ng deposit, pindutin ang <B>Itama ang bakanteng kaha</B> sa page ng
        suki at isulat ang dahilan.
      </>,
    ],
    tips: [
      <>
        Ang bakanteng kaha sa bodega ay makikita sa <B>Stock</B>. Nababawasan ito kapag ibinigay ninyo sa supplier sa{" "}
        <B>Dumating ang delivery</B>.
      </>,
    ],
  },
  {
    id: "produkto",
    title: "Mga produkto at presyo",
    short: "Mga produkto",
    icon: Package,
    tone: "orange",
    steps: [
      <>
        Pindutin ang <B>Produkto</B> sa menu, tapos <B>Magdagdag ng produkto</B>.
      </>,
      <>
        I-type ang pangalan kasama ang laki (hal. Red Horse 1L) at piliin ang uri: Softdrinks, Beer o Iba pa.
      </>,
      <>
        Ilagay ang <B>Presyo kada kaha</B> at ang <B>Puhunan kada kaha</B>. Ang puhunan ay para makita ang tubo.
      </>,
      <>
        Buksan ang <B>May ibinabalik na bote at kaha</B> para sa mga boteng ibinabalik. I-off ito para sa PET bottles at lata.
      </>,
      <>
        Sa <B>Babala kapag paubos na</B>, ilagay kung ilang kaha na lang bago kayo balaan ng app. Ilagay ang 0 kung ayaw ng babala.
      </>,
    ],
    tips: [
      <>
        Para palitan ang presyo, pindutin ang <B>Baguhin</B> sa produkto. Ang bagong presyo ay para lang sa mga bagong order;
        hindi nagbabago ang mga lumang order.
      </>,
    ],
    action: { to: "/products", label: "Buksan ang mga produkto" },
  },
  {
    id: "print",
    title: "Pag-print ng resibo",
    short: "Pag-print",
    icon: Printer,
    tone: "gray",
    steps: [
      <>
        Pumunta sa <B>Settings</B>. Sa <B>Papel ng resibo</B>, piliin ang 58 mm o 80 mm, ayon sa laki ng papel ng printer ninyo.
      </>,
      <>
        Sa <B>Ilang kopya ng resibo</B>, piliin ang <B>2 kopya</B> kung gusto ninyong may kopya ang suki at may kopya kayo.
      </>,
      <>
        Pindutin ang <B>Subukang mag-print</B> para makita kung tama ang labas.
      </>,
      <>
        Kapag lumabas ang print window, piliin ang receipt printer, itakda ang laki ng papel, at gawing "none" ang margins.
      </>,
    ],
    tips: [<>Sa iPad o cellphone, kailangang AirPrint ang printer.</>],
    action: { to: "/settings", label: "Buksan ang Settings" },
  },
  {
    id: "ulat",
    title: "Ulat: benta, bayad at utang",
    short: "Ulat",
    icon: BarChart3,
    tone: "violet",
    steps: [
      <>
        Sa Home, makikita agad ang <B>Benta</B>, <B>Natanggap na bayad</B>, <B>Kabuuang utang</B> at{" "}
        <B>Mga late sa bayad</B> ngayong araw.
      </>,
      <>
        Para sa mas marami, pindutin ang <B>Ulat</B> sa menu. Makikita ang benta at bayad sa nakaraang 30 araw, ang tubo, ang
        pinakamabentang produkto, at ang pinakamalalaking suki.
      </>,
      <>
        Kung mahirap basahin ang chart, pindutin ang <B>Ipakita bilang table</B>.
      </>,
    ],
    action: { to: "/reports", label: "Buksan ang Ulat" },
  },
  {
    id: "itama",
    title: "Pagtama ng mali",
    short: "Pagtama ng mali",
    icon: Undo2,
    tone: "amber",
    intro: <>Huwag mag-alala kung nagkamali. Halos lahat ay puwedeng itama.</>,
    steps: [
      <>
        <strong>Maling order ngayong araw:</strong> buksan ang order at pindutin ang <B>Baguhin ang order</B>. Puwede lang ito
        habang bukas pa ang araw.
      </>,
      <>
        <strong>Order na hindi na tuloy:</strong> buksan ang order at pindutin ang <B>I-cancel ang order</B>. Babalik ang mga
        kaha sa stock.
      </>,
      <>
        <strong>Maling bayad:</strong> buksan ang order, hanapin ang bayad sa <B>Mga bayad</B>, at pindutin ang{" "}
        <B>Tanggalin</B>. Kung may bayad ang order, tanggalin muna ang bayad bago i-cancel ang order.
      </>,
      <>
        <strong>Basag na bote o maling bilang sa bodega:</strong> pumunta sa <B>Stock</B> at pindutin ang{" "}
        <B>Sira o maling bilang</B>.
      </>,
    ],
    tips: [
      <>
        Lahat ng kinansela at binago ay nakatala sa <B>Settings</B>, sa <B>Talaan ng mga ginawa</B>. Walang nawawala.
      </>,
    ],
  },
];

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Bakit hindi ako makagawa ng order?",
    a: (
      <>
        Baka sarado na ang araw. Pumunta sa <B>Stock</B> at pindutin ang <B>Buksan ulit ang araw</B>.
      </>
    ),
  },
  {
    q: "Bakit sinasabing kulang ang stock?",
    a: (
      <>
        Mas marami ang order kaysa sa stock sa system. Kung may dumating na kaha na hindi pa nailalagay, ilagay muna ito sa{" "}
        <B>Dumating ang delivery</B>.
      </>
    ),
  },
  {
    q: "Bakit pula ang pangalan ng suki?",
    a: <>Late siya sa bayad: lampas na sa due date ang utang niya. Makikita kung ilang araw na siyang late.</>,
  },
  {
    q: "Nakalimutan ko ang password.",
    a: <>Wala pang paraan para palitan ito sa app. Tawagan ang taong nag-set up ng app para sa inyo.</>,
  },
  {
    q: "Masyadong maliit ang letra.",
    a: (
      <>
        Pindutin ang bilog na may letrang <Type className="inline size-5 align-text-bottom" aria-hidden /> sa itaas (sa
        cellphone, ang bilog na may inyong initials) at piliin ang <B>Malaki</B> o <B>Mas malaki</B>.
      </>
    ),
  },
];

export default function Help() {
  useTourPage("help");
  return (
    <div lang="fil">
      <PageHeader
        title="Paano gamitin ang app"
        description="Gabay para sa bawat gawain. Pindutin ang isang paksa para pumunta roon."
      />

      <TourMenu />

      <h2 className="mt-8 mb-3 text-xl font-bold text-ink">Nakasulat na gabay</h2>
      <nav aria-label="Mga paksa" className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="help-topics">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-card hover:shadow-pop"
          >
            <IconTile icon={section.icon} tone={section.tone} />
            <span className="text-base leading-tight font-semibold text-ink">{section.short}</span>
          </a>
        ))}
        <a
          href="#kulay"
          className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-card hover:shadow-pop"
        >
          <IconTile icon={Tags} tone="red" />
          <span className="text-base leading-tight font-semibold text-ink">Mga kulay at salita</span>
        </a>
        <a
          href="#tanong"
          className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-card hover:shadow-pop"
        >
          <IconTile icon={MessageCircleQuestion} tone="gray" />
          <span className="text-base leading-tight font-semibold text-ink">Mga tanong</span>
        </a>
      </nav>

      <div className="mt-8 space-y-6">
        {SECTIONS.map((section) => (
          <GuideSection key={section.id} section={section} />
        ))}
        <ColorsSection />
        <FaqSection />
      </div>
    </div>
  );
}

// Each button opens that screen and starts its walkthrough.
function TourMenu() {
  const { start } = useTour();
  return (
    <Card className="p-5 sm:p-6" data-tour="help-tours">
      <div className="flex items-center gap-4">
        <IconTile icon={CircleHelp} tone="blue" size="lg" />
        <div>
          <h2 className="text-xl font-bold text-ink">Gabay sa mismong screen</h2>
          <p className="mt-0.5 text-base text-ink-3">
            Pumili ng isa. Ipapakita ng app kung saan pipindot, isa-isa. Puwede ring pindutin ang{" "}
            <B>Gabayan ako</B> sa itaas kahit saang page.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOUR_MENU.map((tour) => (
          <button
            key={tour.key}
            type="button"
            onClick={() => start(tour.key, tour.path)}
            className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-white px-4 text-left text-base font-semibold text-ink hover:border-brand hover:bg-brand-soft"
          >
            <PlayCircle className="size-6 shrink-0 text-brand" aria-hidden />
            {tour.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

function SectionShell({
  id,
  icon,
  tone,
  title,
  children,
}: {
  id: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24" aria-labelledby={`${id}-title`}>
      <Card className="p-5 sm:p-7">
        <div className="flex items-center gap-4">
          <IconTile icon={icon} tone={tone} size="lg" />
          <h2 id={`${id}-title`} className="text-2xl leading-tight font-bold tracking-tight text-ink">
            {title}
          </h2>
        </div>
        {children}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-full pr-4 pl-2 text-base font-semibold text-ink-3 hover:bg-gray-50 hover:text-ink"
        >
          <ArrowUp className="size-5" aria-hidden /> Bumalik sa mga paksa
        </a>
      </Card>
    </section>
  );
}

function GuideSection({ section }: { section: Section }) {
  return (
    <SectionShell id={section.id} icon={section.icon} tone={section.tone} title={section.title}>
      {section.intro && <p className="mt-4 text-lg leading-relaxed text-ink-2">{section.intro}</p>}
      {section.steps && (
        <ol className="mt-5 space-y-4">
          {section.steps.map((step, i) => (
            <li key={i} className="flex gap-4">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white"
                aria-hidden
              >
                {i + 1}
              </span>
              <p className="pt-1.5 text-lg leading-relaxed text-ink">{step}</p>
            </li>
          ))}
        </ol>
      )}
      {section.tips && (
        <div className="mt-6 rounded-2xl border border-[#C7D7FE] bg-[#EFF4FF] p-4 sm:p-5">
          <p className="flex items-center gap-2 text-base font-bold text-[#1E3A8A]">
            <Lightbulb className="size-5" aria-hidden /> Tandaan
          </p>
          <ul className="mt-2 space-y-2">
            {section.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-lg leading-relaxed text-[#1E3A8A]">
                <span aria-hidden>•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {section.action && (
        <div className="mt-6">
          <LinkButton to={section.action.to} size="lg">
            {section.action.label}
          </LinkButton>
        </div>
      )}
    </SectionShell>
  );
}

function ColorsSection() {
  const rows: { chip: ReactNode; meaning: ReactNode }[] = [
    {
      chip: (
        <Chip tone="green" icon={CheckCircle2}>
          Bayad na
        </Chip>
      ),
      meaning: "Bayad na lahat ang order.",
    },
    {
      chip: (
        <Chip tone="amber" icon={Clock}>
          May balanse
        </Chip>
      ),
      meaning: "May bayad na, pero may kulang pa.",
    },
    {
      chip: (
        <Chip tone="amber" icon={Clock}>
          Hindi pa bayad
        </Chip>
      ),
      meaning: "Wala pang bayad (utang).",
    },
    {
      chip: (
        <Chip tone="red" solid icon={AlertTriangle}>
          Late 3 araw
        </Chip>
      ),
      meaning: "Lampas na sa due date ang bayad. Pula rin ang pangalan ng suki.",
    },
    {
      chip: <Chip tone="gray" icon={Truck}>Ide-deliver pa</Chip>,
      meaning: "Hindi pa naide-deliver ang order.",
    },
    {
      chip: <Chip tone="green" icon={Truck}>Na-deliver na</Chip>,
      meaning: "Natanggap na ng suki ang order.",
    },
    {
      chip: <Chip tone="amber">Paubos</Chip>,
      meaning: "Kaunti na lang ang kaha ng produktong ito. Umorder na sa supplier.",
    },
  ];
  return (
    <SectionShell id="kulay" icon={Tags} tone="red" title="Mga kulay at salita">
      <p className="mt-4 text-lg leading-relaxed text-ink-2">
        Ang <strong className="text-[#B42318]">pula</strong> ay para lang sa late na bayad, kulang na stock, at pagbura. Kapag
        may pula, tingnan ito.
      </p>
      <ul className="mt-5 divide-y divide-line rounded-2xl border border-line">
        {rows.map((row, i) => (
          <li key={i} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-5">
            <span className="text-lg sm:w-48 sm:shrink-0">{row.chip}</span>
            <span className="text-lg text-ink">{row.meaning}</span>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

function FaqSection() {
  return (
    <SectionShell id="tanong" icon={MessageCircleQuestion} tone="gray" title="Mga madalas itanong">
      <dl className="mt-5 space-y-5">
        {FAQ.map((item) => (
          <div key={item.q}>
            <dt className="text-lg font-bold text-ink">{item.q}</dt>
            <dd className="mt-1 text-lg leading-relaxed text-ink-2">{item.a}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 flex items-center gap-2 text-base text-ink-3">
        <BookOpen className="size-5" aria-hidden /> Puwedeng balikan ang gabay na ito kahit kailan mula sa menu.
      </p>
    </SectionShell>
  );
}
