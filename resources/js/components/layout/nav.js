import {
  faGauge, faUsers, faCartShopping, faBox,
  faClipboardList, faChartLine, faReceipt, faChartBar,
} from "@fortawesome/free-solid-svg-icons";

/** Itens de navegação compartilhados entre Sidebar (desktop) e MobileDrawer (mobile). */
export const NAV = [
  { to: "/",             label: "Dashboard",                 short: "Início",    icon: faGauge },
  { to: "/integrantes",  label: "Integrantes",               short: "Casa",      icon: faUsers },
  { to: "/compras",      label: "Compras",                   short: "Compras",   icon: faCartShopping },
  { to: "/inventario",   label: "Itens em casa",             short: "Itens",     icon: faBox },
  { to: "/lista",        label: "Próxima lista de compras",  short: "Lista",     icon: faClipboardList },
  { to: "/precos",       label: "Acompanhamento de Preços",  short: "Preços",    icon: faChartLine },
  { to: "/contas",       label: "Contas da Casa",            short: "Contas",    icon: faReceipt },
  { to: "/analises",     label: "Análises Financeiras",      short: "Análises",  icon: faChartBar },
];
