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
<div class="pub-list pub-list--compact">
  {% for pub in year.items %}
  <div class="pub-entry">
    <span class="venue-badge venue-badge--{{ pub.venue_type }}">{{ pub.venue_short }}</span>
    <div class="pub-title">{% if pub.paperurl %}<a href="{{ pub.paperurl }}">{{ pub.title }}</a>{% else %}{{ pub.title }}{% endif %}</div>
    {% include pub-authors.html pub=pub %}
    {% unless pub.venue_type == "preprint" %}<div class="pub-venue">{{ pub.venue }}</div>{% endunless %}
    {% if pub.excerpt %}<div class="pub-excerpt">{{ pub.excerpt | strip_html }}</div>{% endif %}
    {% include pub-links.html pub=pub %}
  </div>
  {% endfor %}
</div>
{% endfor %}
