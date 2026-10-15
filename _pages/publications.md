---
layout: archive
title: "Publications"
permalink: /publications/
author_profile: true
---

{% if author.googlescholar %}
  You can also find my articles on <u><a href="{{author.googlescholar}}">my Google Scholar profile</a>.</u>
{% endif %}

{% include base_path %}

{% assign pubs = site.publications | sort: "date" | reverse %}
{% assign years = pubs | group_by_exp: "p", "p.date | date: '%Y'" %}
{% for year in years %}
<h2 class="pub-year">{{ year.name }}</h2>
<div class="pub-list">
  {% for pub in year.items %}{% include pub-card.html pub=pub excerpt=true %}{% endfor %}
</div>
{% endfor %}
