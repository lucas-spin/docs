import { AppPage } from "@/pages/AppPage";
import { PlaygroundPage } from "@/pages/Playground";
import { Router } from "typecomposer";
import { loadDocs } from "@/utils/mdx";
import { BaseView } from "@/views/elements/Base";
import { HomePage } from "@/pages/Home";

loadDocs().finally(() => {
  Router.create({
    history: "browser",
    routes: [
      { path: "/", component: HomePage },
      {
        path: "/docs",
        component: AppPage,
        children: [
          { path: "getting-started", component: BaseView },
          { path: "skills", component: BaseView },
          { path: "components/component", component: BaseView },
          { path: "components/template", component: BaseView },
          { path: "components/lifecycle-docs", component: BaseView },
          { path: "components/examples", component: BaseView },
          { path: "dependency-injection", component: BaseView },
          { path: "elements/div", component: BaseView },
          { path: "elements/button", component: BaseView },
          { path: "elements/input", component: BaseView },
          { path: "elements/table", component: BaseView },
          { path: "elements/label", component: BaseView },
          { path: "elements/span", component: BaseView },
          { path: "elements/heading", component: BaseView },
          { path: "layout/vbox", component: BaseView },
          { path: "layout/hbox", component: BaseView },
          { path: "layout/border-panel", component: BaseView },
          { path: "reactivity/fundamentals", component: BaseView },
          { path: "reactivity/ref", component: BaseView },
          { path: "reactivity/refboolean", component: BaseView },
          { path: "reactivity/refnumber", component: BaseView },
          { path: "reactivity/refstring", component: BaseView },
          { path: "reactivity/reflist", component: BaseView },
          { path: "reactivity/refmap", component: BaseView },
          { path: "reactivity/refset", component: BaseView },
          { path: "reactivity/refobject", component: BaseView },
          { path: "reactivity/refproperty", component: BaseView },
          { path: "reactivity/refstate", component: BaseView },
          { path: "reactivity/computed", component: BaseView },
          { path: "router", component: BaseView },
          { path: "router-view", component: BaseView },
          { path: "home", component: BaseView },
        ],
      },
      { path: "/playground", component: PlaygroundPage },
      { path: Router.PATH_WILDCARD, redirect: "/docs/home" },
    ],
  });
});
