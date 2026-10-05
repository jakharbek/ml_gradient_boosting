"""Графики курса для Jupyter и примеров (matplotlib).

Все функции принимают ``ax`` (или создают фигуру сами), используют роли цветов из
:mod:`gbcourse.style` и подписаны по-русски. Вызовите :func:`use_course_style`
один раз в начале ноутбука.
"""

from __future__ import annotations

import numpy as np

from . import style
from .datasets import true_function
from .style import ROLE, use_course_style  # noqa: F401  (реэкспорт для удобства)


def _plt():
    import matplotlib.pyplot as plt

    return plt


def figure(nrows: int = 1, ncols: int = 1, width: float = 7.5, row_height: float = 3.6, **kw):
    """Фигура с сеткой осей нужного размера."""
    plt = _plt()
    fig, axes = plt.subplots(nrows, ncols, figsize=(width, row_height * nrows), **kw)
    return fig, axes


def _grid_1d(X, n: int = 500, pad: float = 0.0):
    x = np.asarray(X, float).ravel()
    lo, hi = float(np.min(x)), float(np.max(x))
    span = hi - lo or 1.0
    return np.linspace(lo - pad * span, hi + pad * span, n)


# ---------------------------------------------------------------------------------
# Одномерная регрессия
# ---------------------------------------------------------------------------------


def plot_data(ax, X, y, label: str | None = "Данные", **kw):
    """Точки данных: нейтральный цвет, кольцо цвета фона для читаемости."""
    params = dict(s=22, color=ROLE["data"], alpha=0.85, edgecolor=style.SURFACE, linewidth=0.8, zorder=3)
    params.update(kw)
    return ax.scatter(np.asarray(X, float).ravel(), np.asarray(y, float), label=label, **params)


def plot_truth(ax, kind: str, x_min: float = 0.0, x_max: float = 10.0, label: str = "Истинная функция"):
    """Истинная функция набора ``regression_1d(kind=...)`` — пунктиром как ориентир."""
    xs = np.linspace(x_min, x_max, 400)
    return ax.plot(xs, true_function(kind, xs), color=ROLE["truth"], lw=1.5, ls=(0, (5, 4)),
                   label=label, zorder=2)


def plot_curve(ax, xs, ys, role: str = "model", label: str | None = None, **kw):
    """Линия заданной роли (model, tree, model_prev, train, valid…)."""
    params = dict(color=ROLE.get(role, role), lw=2.0, zorder=4)
    params.update(kw)
    return ax.plot(xs, ys, label=label, **params)


def plot_predict_1d(ax, predict, X, role: str = "model", label: str | None = "Модель", n: int = 600, **kw):
    """Кривая предсказаний модели на плотной сетке (деревья дают «ступеньки»)."""
    xs = _grid_1d(X, n)
    return plot_curve(ax, xs, predict(xs.reshape(-1, 1)), role=role, label=label, **kw)


def plot_residuals(ax, X, y, F, label: str | None = "Остатки", **kw):
    """Вертикальные отрезки от прогноза F(xᵢ) до ответа yᵢ."""
    x = np.asarray(X, float).ravel()
    params = dict(colors=ROLE["residual"], linewidth=1.1, alpha=0.7, zorder=2)
    params.update(kw)
    return ax.vlines(x, np.asarray(F, float), np.asarray(y, float), label=label, **params)


def plot_boosting_step(model, X, y, m: int, axes=None, truth_kind: str | None = None):
    """Итерация m бустинга (регрессия) на двух панелях.

    Слева: данные, F_{m−1}, F_m и остатки относительно F_{m−1}.
    Справа: остатки rᵢ = yᵢ − F_{m−1}(xᵢ) и дерево hₘ, которое их приближает.
    """
    plt = _plt()
    if axes is None:
        _, axes = plt.subplots(1, 2, figsize=(11, 3.8))
    ax1, ax2 = axes
    X = np.asarray(X, float).reshape(-1, 1)
    xs = _grid_1d(X).reshape(-1, 1)
    F_prev = model.predict_raw(X, m - 1)
    plot_residuals(ax1, X, y, F_prev)
    plot_data(ax1, X, y)
    if truth_kind:
        plot_truth(ax1, truth_kind, float(X.min()), float(X.max()))
    plot_curve(ax1, xs.ravel(), model.predict_raw(xs, m - 1), role="model_prev", label=f"F$_{{{m - 1}}}$(x)", lw=1.6)
    plot_curve(ax1, xs.ravel(), model.predict_raw(xs, m), role="model", label=f"F$_{{{m}}}$(x)")
    ax1.set_title(f"Итерация {m}: модель до и после шага")
    ax1.set_xlabel("x")
    ax1.set_ylabel("y")
    ax1.legend(loc="best")

    r = np.asarray(y, float) - F_prev
    tree = model.trees_[m - 1][0]
    ax2.axhline(0, color=style.AXIS, lw=1, zorder=1)
    plot_data(ax2, X, r, label="Остатки rᵢ")
    plot_curve(ax2, xs.ravel(), tree.predict(xs), role="tree", label=f"Дерево h$_{{{m}}}$(x)")
    ax2.set_title(f"Дерево h$_{{{m}}}$ учится предсказывать остатки")
    ax2.set_xlabel("x")
    ax2.set_ylabel("остаток")
    ax2.legend(loc="best")
    return axes


def plot_stages(model, X, y, stages=(1, 3, 10, 50), truth_kind: str | None = None, ncols: int = 2):
    """«Малые множители»: как модель выглядит после разного числа деревьев."""
    plt = _plt()
    stages = [s for s in stages if s <= model.n_trees_]
    nrows = int(np.ceil(len(stages) / ncols))
    fig, axes = plt.subplots(nrows, ncols, figsize=(5.2 * ncols, 3.2 * nrows), sharex=True, sharey=True,
                             squeeze=False)
    xs = _grid_1d(X).reshape(-1, 1)
    for ax, s in zip(axes.ravel(), stages):
        plot_data(ax, X, y, label=None, s=14)
        if truth_kind:
            plot_truth(ax, truth_kind, float(np.min(X)), float(np.max(X)), label=None)
        plot_curve(ax, xs.ravel(), model.predict_raw(xs, s), role="model")
        ax.set_title(f"M = {s}")
    for ax in axes.ravel()[len(stages):]:
        ax.set_visible(False)
    fig.tight_layout()
    return fig


# ---------------------------------------------------------------------------------
# Кривые обучения, классификация
# ---------------------------------------------------------------------------------


def plot_learning_curves(ax, history: dict, best_iteration: int | None = None, ylabel: str = "Потери",
                         labels=("Обучение", "Валидация")):
    """Потери на обучении и валидации по итерациям (итерация 0 — константа F₀)."""
    tr = history.get("train", [])
    ev = history.get("eval", [])
    ax.plot(range(len(tr)), tr, color=ROLE["train"], label=labels[0])
    if ev:
        ax.plot(range(len(ev)), ev, color=ROLE["valid"], label=labels[1])
        if best_iteration is not None:
            ax.axvline(best_iteration, color=style.MUTED, lw=1, ls=(0, (4, 3)))
            ax.annotate(f"лучшая: {best_iteration}", (best_iteration, ev[best_iteration]),
                        xytext=(6, 10), textcoords="offset points", color=style.INK_2, fontsize=9)
    ax.set_xlabel("Итерация (число деревьев)")
    ax.set_ylabel(ylabel)
    if ev:
        ax.legend()
    return ax


def plot_decision_surface(ax, predict_proba, X, y, resolution: int = 160, pad: float = 0.4,
                          show_contour: bool = True, title: str | None = None):
    """Вероятность класса 1 (бинарная) или победивший класс (многоклассовая) на плоскости."""
    X = np.asarray(X, float)
    y = np.asarray(y).astype(int)
    x0 = np.linspace(X[:, 0].min() - pad, X[:, 0].max() + pad, resolution)
    x1 = np.linspace(X[:, 1].min() - pad, X[:, 1].max() + pad, resolution)
    g0, g1 = np.meshgrid(x0, x1)
    P = np.asarray(predict_proba(np.column_stack([g0.ravel(), g1.ravel()])))
    classes = ROLE["classes"]
    if P.ndim == 2 and P.shape[1] > 2:
        from matplotlib.colors import to_rgb

        k = P.argmax(axis=1)
        conf = P.max(axis=1)
        rgb = np.array([to_rgb(classes[i]) for i in range(P.shape[1])])[k]
        surface = np.array(to_rgb(style.SURFACE))
        a = 0.15 + 0.45 * (conf - 1 / P.shape[1]) / (1 - 1 / P.shape[1])
        img = surface * (1 - a[:, None]) + rgb * a[:, None]
        ax.imshow(img.reshape(resolution, resolution, 3), origin="lower", aspect="auto",
                  extent=(x0[0], x0[-1], x1[0], x1[-1]), interpolation="bilinear")
    else:
        p1 = P[:, 1] if P.ndim == 2 else P
        ax.imshow(p1.reshape(resolution, resolution), origin="lower", aspect="auto", vmin=0, vmax=1,
                  extent=(x0[0], x0[-1], x1[0], x1[-1]), cmap=style.cmap_proba(), alpha=0.75,
                  interpolation="bilinear")
        if show_contour:
            ax.contour(g0, g1, p1.reshape(resolution, resolution), levels=[0.5], colors=[style.INK_2],
                       linewidths=1.2)
    for c in np.unique(y):
        m = y == c
        ax.scatter(X[m, 0], X[m, 1], s=20, color=classes[c % len(classes)], edgecolor=style.SURFACE,
                   linewidth=0.8, label=f"Класс {c}", zorder=3)
    ax.set_xlabel("x₀")
    ax.set_ylabel("x₁")
    ax.grid(False)
    ax.legend(loc="upper right")
    if title:
        ax.set_title(title)
    return ax


# ---------------------------------------------------------------------------------
# Деревья, потери, важности
# ---------------------------------------------------------------------------------


def plot_tree(tree, ax=None, feature_names=None, precision: int = 2, highlight_path=None,
              value_label: str = "значение"):
    """Схема дерева: узлы-правила, листья окрашены по значению (синий < 0 < красный)."""
    plt = _plt()
    from matplotlib.colors import TwoSlopeNorm

    nodes = tree.nodes
    names = feature_names or [f"x{j}" for j in range(getattr(tree, "n_features_", 1) or 1)]
    pos: dict[int, tuple[float, float]] = {}
    counter = [0.0]

    def layout(nid: int) -> float:
        nd = nodes[nid]
        if nd.is_leaf:
            x = counter[0]
            counter[0] += 1.0
        else:
            x = (layout(nd.left) + layout(nd.right)) / 2.0
        pos[nid] = (x, -float(nd.depth))
        return x

    layout(0)
    n_leaves = max(1.0, counter[0])
    depth = max(1, max(nd.depth for nd in nodes))
    if ax is None:
        _, ax = plt.subplots(figsize=(max(5.0, 1.9 * n_leaves), 1.5 * (depth + 1)))
    leaf_vals = [nd.value for nd in nodes if nd.is_leaf]
    vmax = max(1e-12, max(abs(v) for v in leaf_vals))
    norm = TwoSlopeNorm(vmin=-vmax, vcenter=0.0, vmax=vmax)
    cmap = style.cmap_diverging()
    hp = set(highlight_path or [])
    for nd in nodes:
        if nd.is_leaf:
            continue
        for child, lab in ((nd.left, "да"), (nd.right, "нет")):
            (x0, y0), (x1, y1) = pos[nd.id], pos[child]
            on = nd.id in hp and child in hp
            ax.plot([x0, x1], [y0, y1], color=style.INK if on else style.AXIS, lw=2.2 if on else 1.2, zorder=1)
            ax.text((x0 + x1) / 2, (y0 + y1) / 2, lab, fontsize=8, color=style.MUTED, ha="center",
                    va="center", bbox=dict(boxstyle="round,pad=0.15", fc=style.SURFACE, ec="none"))
    for nd in nodes:
        x, y = pos[nd.id]
        if nd.is_leaf:
            txt = f"{value_label}\n{nd.value:.{precision}f}\nn = {nd.n}"
            fc = cmap(norm(nd.value))
            lum = 0.299 * fc[0] + 0.587 * fc[1] + 0.114 * fc[2]
            tc = "white" if lum < 0.55 else style.INK
        else:
            txt = f"{names[nd.feature]} ≤ {nd.threshold:.{precision}f}\nn = {nd.n}"
            fc, tc = style.PAGE, style.INK
        ec = style.INK if nd.id in hp else style.AXIS
        ax.text(x, y, txt, ha="center", va="center", fontsize=9, color=tc, zorder=3,
                bbox=dict(boxstyle="round,pad=0.45", fc=fc, ec=ec, lw=1.6 if nd.id in hp else 1.0))
    ax.set_xlim(-0.7, n_leaves - 0.3)
    ax.set_ylim(-depth - 0.6, 0.6)
    ax.axis("off")
    return ax


def plot_loss_functions(ax, names=("squared", "absolute", "huber"), r_max: float = 3.0, delta: float = 1.0,
                        alpha: float = 0.8):
    """Потери как функции остатка r = y − F."""
    from .losses import get_loss

    r = np.linspace(-r_max, r_max, 401)
    titles = {"squared": "½r² (L2)", "absolute": "|r| (L1)", "huber": f"Хьюбер, δ = {delta}",
              "quantile": f"Квантильная, α = {alpha}"}
    for i, nm in enumerate(names):
        loss = get_loss(nm, delta=delta, alpha=alpha)
        ax.plot(r, loss.pointwise(r, np.zeros_like(r)), color=style.SERIES[i], label=titles.get(nm, nm))
    ax.set_xlabel("остаток r = y − F")
    ax.set_ylabel("потери L")
    ax.legend()
    return ax


def plot_importance(ax, values, names, errors=None, top: int | None = None, xlabel: str = "Важность"):
    """Горизонтальные столбцы важности, отсортированные по убыванию."""
    values = np.asarray(values, float)
    order = np.argsort(values)[::-1]
    if top:
        order = order[:top]
    order = order[::-1]
    y = np.arange(order.size)
    ax.barh(y, values[order], height=0.55, color=style.BLUE,
            xerr=None if errors is None else np.asarray(errors)[order], ecolor=style.INK_2)
    ax.set_yticks(y, [names[i] for i in order])
    ax.set_xlabel(xlabel)
    ax.grid(axis="y", visible=False)
    return ax


def plot_shap_waterfall(ax, base: float, phi, names, x=None, max_display: int = 10, precision: int = 2):
    """Водопад SHAP: как от базового значения E[f] прийти к прогнозу f(x)."""
    phi = np.asarray(phi, float)
    order = np.argsort(np.abs(phi))[::-1][:max_display]
    rest = phi.sum() - phi[order].sum()
    labels = [names[i] + (f" = {x[i]:.{precision}g}" if x is not None else "") for i in order]
    contrib = list(phi[order])
    if abs(rest) > 1e-12:
        labels.append("остальные признаки")
        contrib.append(rest)
    start = base
    for i, c in enumerate(contrib):
        color = style.RED if c > 0 else style.BLUE
        ax.barh(i, c, left=start, height=0.6, color=color)
        ax.text(start + c + (0.01 if c >= 0 else -0.01) * max(1e-9, np.abs(phi).sum()), i,
                f"{c:+.{precision}f}", va="center", ha="left" if c >= 0 else "right", fontsize=9,
                color=style.INK_2)
        start += c
    ax.axvline(base, color=style.MUTED, lw=1, ls=(0, (4, 3)))
    ax.axvline(start, color=style.INK_2, lw=1)
    ax.set_yticks(range(len(labels)), labels)
    ax.invert_yaxis()
    ax.set_xlabel(f"вклад в прогноз: E[f] = {base:.{precision}f} → f(x) = {start:.{precision}f}")
    ax.grid(axis="y", visible=False)
    return ax
