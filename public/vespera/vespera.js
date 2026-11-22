// Preenche os campos ocultos do formulário: variante do teste A/B, UTMs e página de retorno.
(function () {
  var v = document.documentElement.getAttribute("data-variant") || "a";
  try { localStorage.setItem("vespera_ab", v); } catch (e) {}
  var f = document.getElementById("lead");
  if (!f) return;
  var set = function (name, value) {
    var i = f.querySelector('input[name="' + name + '"]');
    if (!i) { i = document.createElement("input"); i.type = "hidden"; i.name = name; f.appendChild(i); }
    i.value = value;
  };
  set("variante", v);
  set("_next", location.origin + "/vespera/obrigado/");
  var q = new URLSearchParams(location.search);
  ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach(function (k) {
    if (q.get(k)) set(k, q.get(k));
  });
})();
